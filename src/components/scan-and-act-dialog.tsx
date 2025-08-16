'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, Result } from "@zxing/library";

declare global {
  interface Window { BarcodeDetector?: any; }
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (text: string) => void;
};

type Phase = "idle" | "scanning" | "submitting" | "success" | "error";

export default function ScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any | null>(null);

  const [hint, setHint] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");

  const lockRef = useRef(false);
  const lastValueRef = useRef<string>("");
  const cooldownUntilRef = useRef<number>(0);

  const stopTracks = useCallback(() => {
    try { readerRef.current?.reset(); } catch {}
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
  }, []);

  const closeDialog = useCallback(() => {
    stopTracks();
    setPhase("idle");
    onOpenChange(false);
  }, [onOpenChange, stopTracks]);

  const normalize = (s: string) =>
    String(s).trim().replace(/[\x1D\x1E\x1F]/g, "");

  const submit = useCallback(async (raw: string) => {
    const now = Date.now();
    if (lockRef.current || now < cooldownUntilRef.current) return;
    const cleaned = normalize(raw);

    if (cleaned && cleaned === lastValueRef.current) {
      cooldownUntilRef.current = now + 800;
      return;
    }

    lockRef.current = true;
    setPhase("submitting");
    setHint("Reading…");

    try {
      // The onDetected prop in this component *is* the submit action
      // It handles server validation and closing the dialog on success
      await onDetected(cleaned);
      // If onDetected doesn't throw, we assume success
      setPhase("success");
      setHint("Found! Opening…");
      try { navigator.vibrate?.(50); } catch {}
      stopTracks();
      // The parent component is responsible for closing the dialog on success
    } catch (e: any) {
      setPhase("error");
      setHint(e?.message || "Unrecognized code. Hold steady and try again.");
      lastValueRef.current = cleaned;
      cooldownUntilRef.current = Date.now() + 1000;
    } finally {
      lockRef.current = false;
    }
  }, [onDetected, stopTracks]);

  const start = useCallback(async () => {
    if (!open) return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setHint("Camera API unavailable.");
      return;
    }

    setPhase("scanning");
    setHint("Opening camera…");
    lastValueRef.current = "";
    cooldownUntilRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } , width: { ideal: 1280 }, height: { ideal: 720 }},
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setHint("Point at the code…");

      const Native = window.BarcodeDetector;
      let canNativeDM = false;
      try {
        if (Native && typeof Native.getSupportedFormats === "function") {
          const fmts: string[] = await Native.getSupportedFormats();
          canNativeDM = fmts.includes("data_matrix");
        }
      } catch {}

      if (canNativeDM) {
        detectorRef.current = new Native({ formats: ["data_matrix", "qr_code", "code_128"] });
        const loop = async () => {
          if (phase === "success" || phase === "idle") return;
          try {
            const codes = await detectorRef.current.detect(video);
            const hit = codes?.find((c: any) => String(c?.rawValue || "").trim());
            if (hit && !lockRef.current) {
              const text = String(hit.rawValue).trim();
              submit(text);
            }
          } catch { /* keep scanning */ }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } else {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        readerRef.current = new BrowserMultiFormatReader(hints, 250);
        await readerRef.current.decodeFromVideoElement(video, (result?: Result) => {
          if (!result || lockRef.current) return;
          const text = result.getText?.();
          if (text && typeof text === "string" && text.trim()) {
            submit(text.trim());
          }
        });
      }
    } catch (e: any) {
      setPhase("error");
      setHint(e?.name === "NotAllowedError" ? "Camera permission denied." : "Unable to start camera.");
    }
  }, [open, phase, submit]);

  useEffect(() => {
    if (open) {
      start();
    } else {
      stopTracks();
      setPhase("idle");
    }
    return () => {
      stopTracks();
    };
  }, [open, start, stopTracks]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopTracks();
      else if (open) start();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [open, start, stopTracks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-[480px]">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Scan Batch Code</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-[72%] w-[72%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          <div className={cn("absolute bottom-2 left-1/2 -translate-x-1/2 rounded px-3 py-1 text-xs text-white",
            phase === 'submitting' && 'bg-blue-600',
            phase === 'error' && 'bg-destructive',
            phase === 'scanning' && 'bg-black/60',
            phase === 'success' && 'bg-green-600'
          )}>
            {phase === 'submitting' ? <Loader2 className="animate-spin" /> : hint}
          </div>
        </div>

        <DialogFooter className="p-3">
          <Button variant="outline" onClick={closeDialog}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
