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
  const rafRef = useRef<number | null>(null);
  const vfcRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const preferredResolution = { w: 1920, h: 1080 };
  const overlayScale = Math.max(0.55, Math.min(1, roiScale));
  const useFullFrame = false;
  
  const [camState, setCamState] = useState<CamState>("idle");
  const [engine, setEngine] = useState<Engine>("none");
  const [torch, setTorch] = useState(false);
  const [lastErr, setLastErr] = useState<string | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const workerBusyRef = useRef<boolean>(false);
  const lastDecodeStartRef = useRef<number>(0);
  const [decodedText, setDecodedText] = useState<string | null>(null); // New state for decoded text

  // duplicate suppression: require 2 consecutive identical reads within 2s
  const lastRef = useRef<{ text: string; t: number; confirmed: boolean }>({ text: "", t: 0, confirmed: false });

  // devices & resolution
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  useEffect(() => {
    (async () => {
      if (!navigator.mediaDevices?.enumerateDevices || deviceId) return;
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const vids = list.filter((d) => d.kind === "videoinput");
        if (!vids.length) return;
        const back = vids.find((d) => /back|rear|environment/i.test(d.label));
        setDeviceId(back?.deviceId || vids[0].deviceId);
      } catch {
        // ignore
      }
    })();
  }, [deviceId]);

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
    stopAll();
    setLastErr(null);
    setCamState("requesting");

    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      setCamState("idle");
      setLastErr("Camera requires HTTPS (or localhost).");
      return;
    }

    try {
      const video: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: preferredResolution.w }, height: { ideal: preferredResolution.h } }
        : { facingMode: { ideal: "environment" }, width: { ideal: preferredResolution.w }, height: { ideal: preferredResolution.h } };
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      streamRef.current = stream;
    } catch (e: any) {
      setCamState("permission_denied");
      setLastErr(e?.message || "Permission denied");
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

    setCamState("streaming");

    // Choose engine: Only native if **Data Matrix** is supported
    const nativeDM = await chooseNativeEngine();
    if (nativeDM) {
      setEngine("native");
      runNativeLoop();
      // Auto-failover: if no decode within 1200ms → switch to WASM
      const failoverAt = Date.now() + 1200;
      const check = () => {
        if (engine !== "native" || camState !== "streaming") return;
        if (lastDecodeStartRef.current && lastDecodeStartRef.current < failoverAt) {
          setEngine("wasm");
          runWasmLoop();
          return;
        }
        setTimeout(check, 200);
      };
      setTimeout(check, 200);
    } else {
      setEngine("wasm");
      runWasmLoop();
    }
  }

  async function chooseNativeEngine(): Promise<boolean> {
    const hasBD = typeof (window as any).BarcodeDetector !== "undefined";
    if (!hasBD) return false;
    try {
      // Some browsers expose getSupportedFormats; prefer DataMatrix when present.
      const fmts: string[] = (await (window as any).BarcodeDetector?.getSupportedFormats?.()) || [];
      const wants = new Set(fmts.map((f) => f.toLowerCase()));
      // Only accept native if Data Matrix is supported explicitly.
      return wants.has("data_matrix") || wants.has("datamatrix");
    } catch {
      // Older impl—assume no Data Matrix (be conservative)
      return false;
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
        lastDecodeStartRef.current = Date.now();
        const barcodes = await detector.detect(vid);
        if (barcodes && barcodes.length) {
          const best = barcodes[0];
          const text = (best.rawValue || best.value || "").toString();
          handleDecoded(text, /*format*/ best.format || "native");
        }
      } catch (e: any) {
        track("scan_decode_fail", { engine: "native", error: e?.message || "detect-error" });
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
    workerRef.current.onmessage = (ev: MessageEvent) => {
      const { ok, result, error, type } = ev.data || {};
      if (type === "READY" || type === "PONG") { return; }
      if (ok && result?.text) {
        workerBusyRef.current = false;
        setLastMs(result.ms ?? null);
        handleDecoded(result.text, result.format || "wasm");
      } else if (!ok) {
        workerBusyRef.current = false;
        setLastErr(error ?? "decode-failed");
        track("scan_decode_fail", { engine: "wasm", reason: error ?? "not-found" });
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
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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
      // throttle: don’t enqueue if the worker is still busy
      if (!workerBusyRef.current) {
        workerBusyRef.current = true;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        workerRef.current?.postMessage({ type: "DECODE", imageData }, [imageData.data.buffer]);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }

  /** ---- COMMON: Handle decoded text with duplicate suppression ---- */
  function handleDecoded(text: string, format: string) {
    if (!text) return;
    console.log("ScannerClient: Decoded raw text:", text); // LOG ADDED
    const now = Date.now();
    const prev = lastRef.current;
    setDecodedText(text); // Set the decoded text here
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

  useEffect(() => {
    startCamera();
  }, []); // Empty dependency array means this runs once on mount

  const statusText =
    camState === "permission_denied"
      ? "Camera permission denied. Tap refresh after allowing access."
      : camState === "no_frames"
      ? "Waiting for video frames…"
      : decodedText
      ? `Last scan: ${
          decodedText.length > 42 ? `${decodedText.slice(0, 42)}…` : decodedText
        }`
      : "Point the QR or Data Matrix label inside the frame.";

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black/70">
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
          playsInline
          muted
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="rounded-2xl border-2 border-white/70 shadow-[0_0_40px_rgba(0,0,0,0.7)]"
            style={{
              width: `${overlayScale * 100}%`,
              height: `${overlayScale * 100}%`,
            }}
          />
        </div>
        {camState !== "streaming" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-sm text-white">
            <p className="text-center opacity-90">
              {camState === "permission_denied"
                ? "Allow camera access to scan."
                : camState === "requesting"
                ? "Opening camera…"
                : "Preparing camera…"}
            </p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-black"
            >
              Refresh camera
            </button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-col">
          <span>{statusText}</span>
          {lastMs != null && camState === "streaming" && (
            <span className="text-[11px] text-muted-foreground/80">
              {engine.toUpperCase()} decode in {lastMs}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTorch}
            disabled={camState !== "streaming"}
            className="rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:bg-white/5 disabled:opacity-50"
          >
            {torch ? "Torch on" : "Torch off"}
          </button>
          <button
            type="button"
            onClick={() => startCamera()}
            className="rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>
      {lastErr && (
        <p className="text-xs text-red-600">
          {lastErr}
          {camState === "permission_denied" && " • Check browser camera settings."}
        </p>
      )}
    </div>
  );
}
