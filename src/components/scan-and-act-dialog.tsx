"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
} from "@zxing/library";
import { Camera } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called once with decoded text */
  onDetected: (text: string) => void;
};

export default function ScanAndActDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [status, setStatus] = useState<"idle" | "init" | "scanning" | "noresult" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Restrict to Data Matrix + QR for faster, more stable scans
  const hints = useMemo(() => {
    const h = new Map();
    h.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
    return h;
  }, []);

  // Start/stop stream when dialog opens/closes
  useEffect(() => {
    if (!open) return;

    let stopped = false;
    setStatus("init");
    setErrorMsg("");

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      // helper to stop any existing stream
      const stopStream = () => {
        try {
          readerRef.current?.reset();
        } catch {}
        readerRef.current = null;
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
          video.srcObject = null;
        }
      };

      // Try: exact environment -> ideal environment -> default
      // Mobile Safari/Chrome honor facingMode hints.
      const tryConstraints: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: "environment" } as any }, audio: false },
        { video: { facingMode: { ideal: "environment" } as any }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      for (const c of tryConstraints) {
        try {
          // On many browsers, camera permission must be user-gesture initiated (opening the modal button counts)
          stream = await navigator.mediaDevices.getUserMedia(c);
          if (stream) break;
        } catch (err: any) {
          // OverconstrainedError means that particular constraint isn't available—fall through to next
          if (err?.name !== "OverconstrainedError") {
            // keep last error; we'll surface a message if all attempts fail
            setErrorMsg(err?.message || "Failed to open camera.");
          }
        }
      }

      if (!stream) {
        setStatus("error");
        if (!errorMsg) setErrorMsg("No camera available or permission denied.");
        return;
      }

      // Hook stream to video
      video.setAttribute("playsinline", "true"); // iOS: avoid fullscreen
      video.muted = true;
      video.srcObject = stream;
      await video.play();

      // Start ZXing decoding from the video element (we own the stream)
      const reader = new BrowserMultiFormatReader(hints, 400);
      readerRef.current = reader;

      setStatus("scanning");
      let gotResult = false;

      reader.decodeFromVideoElement(video, (result, err) => {
        if (stopped) return;

        if (result) {
          gotResult = true;
          // Clean up before reporting
          stopStream();
          onDetected(result.getText());
        }
        // We intentionally ignore transient errors while scanning
      });

      // Gentle hint if nothing detected for a bit
      setTimeout(() => {
        if (!gotResult && !stopped && status === "scanning") setStatus("noresult");
      }, 2000);

      // Cleanup on effect end
      return stopStream;
    };

    const teardownPromise = start();

    return () => {
      (async () => {
        stopped = true;
        try {
          (await teardownPromise)?.();
        } catch {}
        try {
          readerRef.current?.reset();
        } catch {}
        readerRef.current = null;
        const v = videoRef.current;
        if (v?.srcObject) {
          (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
          v.srcObject = null;
        }
        setStatus("idle");
        setErrorMsg("");
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hints, onDetected]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      // stop immediately on close
      try {
        readerRef.current?.reset();
      } catch {}
      readerRef.current = null;
      const vEl = videoRef.current;
      if (vEl?.srcObject) {
        (vEl.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        vEl.srcObject = null;
      }
      setStatus("idle");
      setErrorMsg("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Batch Code
          </DialogTitle>
          <DialogDescription>
            Aim at a <b>Data&nbsp;Matrix</b> or QR code. We’ll auto-detect it.
          </DialogDescription>
        </DialogHeader>

        {/* Video with square finder */}
        <div className="relative w-full aspect-square bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" />

          {/* dim mask */}
          <div className="pointer-events-none absolute inset-0 bg-black/30" />

          {/* square finder box */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-white/70">
            {/* corner accents */}
            <span className="absolute -left-[2px] -top-[2px] h-5 w-5 border-l-4 border-t-4 border-white/90 rounded-tl-sm" />
            <span className="absolute -right-[2px] -top-[2px] h-5 w-5 border-r-4 border-t-4 border-white/90 rounded-tr-sm" />
            <span className="absolute -left-[2px] -bottom-[2px] h-5 w-5 border-l-4 border-b-4 border-white/90 rounded-bl-sm" />
            <span className="absolute -right-[2px] -bottom-[2px] h-5 w-5 border-r-4 border-b-4 border-white/90 rounded-br-sm" />
            {/* subtle scan line (pulses) */}
            <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-white/70 opacity-60 animate-pulse" />
          </div>

          {/* status pill */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="rounded bg-black/60 px-3 py-1 text-xs text-white">
              {status === "init" && "Initializing camera…"}
              {status === "scanning" && "Scanning… hold steady"}
              {status === "noresult" && "Still looking… try more light or move closer"}
              {status === "error" && (errorMsg || "Camera error")}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
