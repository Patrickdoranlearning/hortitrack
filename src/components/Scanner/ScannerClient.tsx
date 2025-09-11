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
  
  const [camState, setCamState] = useState<CamState>("idle");
  const [engine, setEngine] = useState<Engine>("none");
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [useFullFrame, setUseFullFrame] = useState(false);
  const [lastErr, setLastErr] = useState<string | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [workerStatus, setWorkerStatus] = useState<"loading" | "ready" | "error">("loading");
  const workerBusyRef = useRef<boolean>(false);
  const lastDecodeStartRef = useRef<number>(0);
  const [decodedText, setDecodedText] = useState<string | null>(null); // New state for decoded text

  // duplicate suppression: require 2 consecutive identical reads within 2s
  const lastRef = useRef<{ text: string; t: number; confirmed: boolean }>({ text: "", t: 0, confirmed: false });

  // devices & resolution
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [resolution, setResolution] = useState<{ w: number; h: number }>({ w: 1920, h: 1080 });
  useEffect(() => {
    // enumerate after permission; called in startCamera too
    (async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const vids = list.filter((d) => d.kind === "videoinput");
        setDevices(vids);
        // prefer back camera by label if not chosen
        if (!deviceId) {
          const back = vids.find((d) => /back|rear|environment/i.test(d.label));
          setDeviceId(back?.deviceId || vids[0]?.deviceId);
        }
      } catch {}
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
        ? { deviceId: { exact: deviceId }, width: { ideal: resolution.w }, height: { ideal: resolution.h } }
        : { facingMode: { ideal: "environment" }, width: { ideal: resolution.w }, height: { ideal: resolution.h } };
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
    if (caps.zoom) {
      setZoomCaps({ min: caps.zoom.min ?? 1, max: caps.zoom.max ?? 5, step: caps.zoom.step ?? 0.1 });
      setZoom(caps.zoom.min ?? 1);
    }

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
    setWorkerStatus("loading");
    workerRef.current.onmessage = (ev: MessageEvent) => {
      const { ok, result, error, type } = ev.data || {};
      if (type === "READY" || type === "PONG") { setWorkerStatus("ready"); return; }
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
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Camera: {camState}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Engine
            <select
              className="rounded border px-1 py-0.5"
              value={engine}
              onChange={(e) => {
                const val = e.target.value as Engine;
                setEngine(val);
                if (val === "native") runNativeLoop(); else runWasmLoop();
              }}>
              <option value="wasm">WASM</option>
              <option value="native">Native</option>
            </select>
          </label>
          {engine === "wasm" && <span>Worker: {workerStatus}</span>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {devices.length > 1 && (
          <label className="flex items-center gap-1 text-xs">
            Camera
            <select
              className="rounded border px-1 py-0.5"
              value={deviceId}
              onChange={(e) => { setDeviceId(e.target.value); startCamera(); }}>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1 text-xs">
          Resolution
          <select
            className="rounded border px-1 py-0.5"
            value={`${resolution.w}x${resolution.h}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              setResolution({ w, h });
              startCamera();
            }}>
            <option value="1280x720">1280×720</option>
            <option value="1920x1080">1920×1080</option>
            <option value="2560x1440">2560×1440</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {decodedText && <span>Decoded: {decodedText}</span>} {/* Display decoded text here */}
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
