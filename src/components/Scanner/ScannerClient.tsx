
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/telemetry";

type Props = {
  onDecoded: (text: string) => void;
  roiScale?: number; // 0.6..1.0 (portion of shorter side)
};

export default function ScannerClient({ onDecoded, roiScale = 0.7 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // duplicate suppression: require 2 consecutive matches within 2s
  const lastRef = useRef<{ text: string; t: number; confirmed: boolean }>({ text: "", t: 0, confirmed: false });

  const decodeFrame = useCallback(() => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas) return; // guard: not mounted yet
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return; // guard: context unavailable

    const w = vid.videoWidth;
    const h = vid.videoHeight;
    if (!w || !h) return;

    const side = Math.floor(Math.min(w, h) * Math.max(0.5, Math.min(1, roiScale)));
    const x = Math.floor((w - side) / 2);
    const y = Math.floor((h - side) / 2);

    canvas.width = side;
    canvas.height = side;
    ctx.drawImage(vid, x, y, side, side, 0, 0, side, side);
    const imageData = ctx.getImageData(0, 0, side, side);

    workerRef.current?.postMessage({ type: "DECODE", imageData }, [imageData.data.buffer]);
  }, [roiScale]);

  const startCamera = useCallback(async () => {
    setCamErr(null);
    let raf = 0;
    let decoding = false;

    const loop = () => {
      if (!decoding) {
        decoding = true;
        decodeFrame();
      }
      raf = requestAnimationFrame(loop);
    };

    const setup = async () => {
      workerRef.current = new Worker(new URL("@/workers/decoder.worker.ts", import.meta.url), { type: "module" });
      workerRef.current.onmessage = (ev: MessageEvent) => {
        const { ok, result, error } = ev.data || {};
        decoding = false;
        if (ok && result?.text) {
          const now = Date.now();
          const prev = lastRef.current;
          if (result.text === prev.text && now - prev.t < 2000 && !prev.confirmed) {
            lastRef.current = { text: result.text, t: now, confirmed: true };
            track("scan_decode_success", { format: result.format, text_len: result.text.length, ms: result.ms });
            onDecoded(result.text);
          } else if (result.text !== prev.text) {
            lastRef.current = { text: result.text, t: now, confirmed: false };
          } else {
            // same text but took too long; reset timer
            lastRef.current = { text: result.text, t: now, confirmed: false };
          }
        } else if (!ok) {
          track("scan_decode_fail", { reason: error ?? "unknown" });
        }
      };

      // camera
      // HTTPS (or localhost) required; otherwise browsers throw SecurityError.
      if (location.protocol !== "https:" && location.hostname !== "localhost") {
        throw new Error("insecure-origin");
      }
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (e: any) {
        // Normalize common errors for UX
        const msg = String(e?.name || e?.message || "");
        if (msg.includes("NotAllowedError")) setCamErr("Camera permission denied. Please allow access.");
        else if (msg.includes("NotFoundError")) setCamErr("No camera found on this device.");
        else if (msg.includes("SecurityError") || msg.includes("insecure-origin")) setCamErr("Camera requires HTTPS (or localhost).");
        else setCamErr("Unable to access camera.");
        throw e;
      }
      const vid = videoRef.current!;
      vid.srcObject = streamRef.current;
      await vid.play().catch(() => {
        // iOS Safari sometimes needs a user gesture
      });

      // try focus/torch/zoom
      const vTrack = streamRef.current.getVideoTracks()[0];
      if (vTrack) {
        const caps: any = vTrack.getCapabilities?.() || {};
        // focus continuous (best-effort)
        vTrack.applyConstraints?.({ advanced: [{ focusMode: "continuous" }] } as any).catch(() => {});
        // torch
        if (caps.torch) {
          vTrack.applyConstraints({ advanced: [{ torch }] } as any).catch(() => {});
        }
        // zoom
        if (caps.zoom) {
          setZoomCaps({ min: caps.zoom.min ?? 1, max: caps.zoom.max ?? 5, step: caps.zoom.step ?? 0.1 });
          setZoom(caps.zoom.min ?? 1);
        }
      }

      loop();
      setReady(true);
    };

    setup().catch((e) => {
      console.error("scanner_setup_failed", e);
    });

    return () => {
      cancelAnimationFrame(raf);
      workerRef.current?.terminate();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [decodeFrame, onDecoded, torch]);

  useEffect(() => {
    // Try auto-start; if permission blocked, UI shows Retry button
    startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live-apply zoom/torch when state changes
  useEffect(() => {
    const vTrack = streamRef.current?.getVideoTracks()[0];
    if (!vTrack) return;
    const apply = async () => {
      const adv: any = {};
      if (zoom != null) adv.zoom = zoom;
      if (typeof torch === "boolean") adv.torch = torch;
      if (Object.keys(adv).length) {
        await vTrack.applyConstraints({ advanced: [adv] } as any).catch(() => {});
      }
    };
    apply();
  }, [zoom, torch]);

  return (
    <div className="space-y-3">
      <video ref={videoRef} className="w-full rounded-xl bg-black/50" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {camErr && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {camErr}
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-md border px-3 py-1" onClick={() => startCamera()}>
              Retry
            </button>
            <a
              className="rounded-md border px-3 py-1"
              href="about:blank"
              onClick={(e) => {
                e.preventDefault();
                // helpful hint for users
                alert("If you previously blocked the camera, click the site lock icon in your browser’s address bar and allow Camera.");
              }}
            >
              How to allow
            </a>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTorch((v) => !v)}
          className="rounded-lg border px-3 py-1 text-sm hover:bg-muted"
          aria-pressed={torch}
        >
          {torch ? "Torch: On" : "Torch: Off"}
        </button>
        {zoomCaps && (
          <label className="flex items-center gap-2 text-sm">
            Zoom
            <input
              type="range"
              min={zoomCaps.min}
              max={zoomCaps.max}
              step={zoomCaps.step}
              value={zoom ?? zoomCaps.min}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
          </label>
        )}
      </div>
    </div>
  );
}
