"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/telemetry";

type Props = {
  onDecoded: (text: string) => void;
  roiScale?: number; // 0.6..1.0
};

type CamState = "idle" | "requesting" | "permission_denied" | "streaming" | "no_frames" | "stopped";
type Engine = "native" | "wasm" | "none";

export default function ScannerClient({ onDecoded, roiScale = 0.8 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const vfcRef = useRef<number | null>(null);

  const [engine, setEngine] = useState<Engine>("none");
  const [camState, setCamState] = useState<CamState>("idle");
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [useFullFrame, setUseFullFrame] = useState(false);
  const [lastErr, setLastErr] = useState<string | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [workerStatus, setWorkerStatus] = useState<"loading" | "ready" | "error">("loading");

  // duplicate suppression: require 2 consecutive identical reads within 2s
  const lastRef = useRef<{ text: string; t: number; confirmed: boolean }>({ text: "", t: 0, confirmed: false });

  /** ---- START/STOP CAMERA ---- */
  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (vfcRef.current && "cancelVideoFrameCallback" in HTMLVideoElement.prototype) {
      (videoRef.current as any)?.cancelVideoFrameCallback?.(vfcRef.current);
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamState("stopped");
    setEngine("none");
  }, []);

  async function startCamera() {
    setLastErr(null);
    setCamState("requesting");

    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      setCamState("idle");
      setLastErr("Camera requires HTTPS (or localhost).");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
    } catch (e: any) {
      const msg = String(e?.name || e?.message || "");
      if (msg.includes("NotAllowedError")) setCamState("permission_denied");
      else setCamState("idle");
      setLastErr("Camera permission denied or unavailable.");
      return;
    }

    // Attach and wait for real frames
    const vid = videoRef.current!;
    vid.setAttribute("playsinline", "");
    vid.setAttribute("autoplay", "");
    vid.muted = true;
    vid.srcObject = streamRef.current;

    await vid.play().catch(() => { /* some browsers require another user gesture, but we have the button */ });

    // Wait for metadata/first frame
    const ok = await new Promise<boolean>((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve(false); } }, 2500);
      const cb = () => {
        if (done) return;
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          clearTimeout(timer); done = true; resolve(true);
        }
      };
      vid.addEventListener("loadedmetadata", cb, { once: true });
      vid.addEventListener("canplay", cb, { once: true });
      // fallback poll
      const poll = () => {
        if (done) return;
        if (vid.videoWidth > 0) { cb(); } else { setTimeout(poll, 100); }
      };
      poll();
    });

    if (!ok) {
      setCamState("no_frames");
      setLastErr("No video frames detected");
      return;
    }

    // Focus/torch/zoom best-effort
    const vTrack = streamRef.current!.getVideoTracks()[0];
    const caps: any = vTrack.getCapabilities?.() || {};
    vTrack.applyConstraints?.({ advanced: [{ focusMode: "continuous" }] } as any).catch(() => {});
    if (caps.torch) vTrack.applyConstraints({ advanced: [{ torch }] } as any).catch(() => {});
    if (caps.zoom) {
      setZoomCaps({ min: caps.zoom.min ?? 1, max: caps.zoom.max ?? 5, step: caps.zoom.step ?? 0.1 });
      setZoom(caps.zoom.min ?? 1);
    }

    setCamState("streaming");

    // Choose engine: Native if supports DataMatrix or QR; otherwise WASM
    const native = await chooseNativeEngine();
    if (native) {
      setEngine("native");
      runNativeLoop();
    } else {
      setEngine("wasm");
      runWasmLoop();
    }
  }

  /** ---- NATIVE BARCODEDETECTOR PATH ---- */
  async function chooseNativeEngine(): Promise<boolean> {
    const hasBD = typeof (window as any).BarcodeDetector !== "undefined";
    if (!hasBD) return false;
    try {
      // Some browsers expose getSupportedFormats; prefer DataMatrix when present.
      const fmts: string[] = (await (window as any).BarcodeDetector?.getSupportedFormats?.()) || [];
      const wants = new Set(fmts.map((f) => f.toLowerCase()));
      // Accept if either datamatrix or qr_code is present (we still try to read DM labels primarily).
      return wants.has("data_matrix") || wants.has("datamatrix") || wants.has("qr_code");
    } catch {
      // Older impl—still try
      return true;
    }
  }

  function runNativeLoop() {
    const vid = videoRef.current!;
    // @ts-ignore
    const detector = new (window as any).BarcodeDetector({
      formats: ["data_matrix", "qr_code"],
    });

    const onFrame = async () => {
      if (!streamRef.current) return;
      try {
        const barcodes = await detector.detect(vid);
        if (barcodes && barcodes.length) {
          const best = barcodes[0];
          const text = (best.rawValue || best.value || "").toString();
          handleDecoded(text, /*format*/ best.format || "native");
        }
      } catch (e: any) {
        setLastErr(e?.message || "native-detect-failed");
      }
      rafRef.current = requestAnimationFrame(onFrame);
    };

    rafRef.current = requestAnimationFrame(onFrame);
  }

  /** ---- WASM WORKER PATH ---- */
  function ensureWorker() {
    if (workerRef.current) return;
    try {
      workerRef.current = new Worker(new URL("@/workers/decoder.worker.ts", import.meta.url), { type: "module" });
    } catch {
      workerRef.current = new Worker(new URL("../../workers/decoder.worker.ts", import.meta.url), { type: "module" });
    }
    setWorkerStatus("loading");
    workerRef.current.onmessage = (ev: MessageEvent) => {
      const { ok, result, error, type } = ev.data || {};
      if (type === "READY" || type === "PONG") { setWorkerStatus("ready"); return; }
      if (ok && result?.text) {
        setLastMs(result.ms ?? null);
        handleDecoded(result.text, result.format || "wasm");
      } else if (!ok) {
        setLastErr(error ?? "decode-failed");
      }
    };
    // handshake
    workerRef.current.postMessage({ type: "PING" });
  }

  function runWasmLoop() {
    ensureWorker();

    const loop = () => {
      if (!streamRef.current) return;
      const vid = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || vid.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const w = vid.videoWidth, h = vid.videoHeight;
      if (useFullFrame) {
        canvas.width = w; canvas.height = h;
        ctx.drawImage(vid, 0, 0, w, h, 0, 0, w, h);
      } else {
        const side = Math.floor(Math.min(w, h) * Math.max(0.5, Math.min(1, roiScale)));
        const x = Math.floor((w - side) / 2);
        const y = Math.floor((h - side) / 2);
        canvas.width = side; canvas.height = side;
        ctx.drawImage(vid, x, y, side, side, 0, 0, side, side);
      }
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      workerRef.current?.postMessage({ type: "DECODE", imageData }, [imageData.data.buffer]);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }

  /** ---- COMMON: Handle decoded text with duplicate suppression ---- */
  function handleDecoded(text: string, format: string) {
    if (!text) return;
    const now = Date.now();
    const prev = lastRef.current;
    if (text === prev.text && now - prev.t < 2000 && !prev.confirmed) {
      lastRef.current = { text, t: now, confirmed: true };
      track("scan_decode_success", { format, text_len: text.length, ms: lastMs ?? undefined });
      onDecoded(text);
    } else if (text !== prev.text) {
      lastRef.current = { text, t: now, confirmed: false };
    } else {
      lastRef.current = { text, t: now, confirmed: false };
    }
  }

  /** ---- UI handlers ---- */
  const onToggleTorch = async () => {
    setTorch((v) => !v);
    const vTrack = streamRef.current?.getVideoTracks()[0];
    await vTrack?.applyConstraints?.({ advanced: [{ torch: !torch }] } as any).catch(() => {});
  };
  const onZoomChange = async (z: number) => {
    setZoom(z);
    const vTrack = streamRef.current?.getVideoTracks()[0];
    await vTrack?.applyConstraints?.({ advanced: [{ zoom: z }] } as any).catch(() => {});
  };

  useEffect(() => stopAll, [stopAll]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
          onClick={() => startCamera()}
          disabled={camState === "requesting" || camState === "streaming"}
        >
          {camState === "streaming" ? "Scanning…" : "Start scanning"}
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
          onClick={() => stopAll()}
          disabled={camState !== "streaming"}
        >
          Stop
        </button>
        <label className="ml-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useFullFrame} onChange={(e) => setUseFullFrame(e.target.checked)} />
          Full-frame mode
        </label>
      </div>

      <div className="relative">
        <video ref={videoRef} className="w-full rounded-xl bg-black/50" playsInline muted />
        {!useFullFrame && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border-2 border-white/70" style={{ width: "80%", height: "80%" }} />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {/* Debug/status bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Cam: {camState}</span>
        <span>Engine: {engine}</span>
        {engine === "wasm" && <span>Worker: {workerStatus}</span>}
        {lastMs != null && <span>Last decode: {lastMs}ms</span>}
        {lastErr && <span className="text-red-700">Err: {lastErr}</span>}
        {zoomCaps && (
          <label className="ml-auto inline-flex items-center gap-2">
            Zoom
            <input
              type="range"
              min={zoomCaps.min}
              max={zoomCaps.max}
              step={zoomCaps.step}
              value={zoom ?? zoomCaps.min}
              onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            />
          </label>
        )}
        <button type="button" onClick={onToggleTorch} className="rounded-md border px-2 py-0.5">
          {torch ? "Torch: On" : "Torch: Off"}
        </button>
      </div>
    </div>
  );
}
