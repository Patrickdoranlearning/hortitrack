"use client";

import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, Result } from "@zxing/library";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onBatchResolved: (payload: { batch: any; summary: any }) => void; // hook into your existing detail dialog
};

export default function ScannerDialog({ open, onOpenChange, onBatchResolved }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hintText, setHintText] = useState("Point your camera at a HortiTrack code…");
  const { toast } = useToast();

  // stop everything cleanly
  const stop = () => {
    try { readerRef.current?.reset(); } catch {}
    readerRef.current = null;
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;

    const start = async () => {
      if (typeof window === "undefined") return;

      // HTTPS / permissions guard
      if (!window.isSecureContext) {
        setHintText("Camera requires HTTPS (or localhost).");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setHintText("Camera API not available in this browser.");
        return;
      }

      // ZXing hints – include Data Matrix
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
      ]);
      // small delay between attempts
      readerRef.current = new BrowserMultiFormatReader(hints, 300);

      try {
        // 1) Try to get the rear camera directly (works on most mobile)
        setHintText("Opening camera…");
        let stream: MediaStream | null = null;

        try {
          // Prefer rear camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" }, // prefer back camera
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback to any camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (cancelled) {
          stream?.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream!;
        if (videoRef.current) {
          videoRef.current.srcObject = stream!;
          await videoRef.current.play().catch(() => {});
        }

        // On iOS, labels are empty until permission is granted.
        // We already opened a stream so now decode using ZXing.
        setHintText("Looking for a code…");

        // Use decodeFromVideoElement for consistent behavior
        await readerRef.current!.decodeFromVideoElement(videoRef.current!, (result?: Result, err?: any) => {
          if (cancelled) return;
          if (result?.getText) {
            const text = result.getText().trim();
            // Freeze scanning until we resolve
            stop();
            handleHit(text);
          }
        });
      } catch (e: any) {
        console.error("Scanner init error:", e);
        if (e?.name === "OverconstrainedError") {
          setHintText("Camera constraints not supported. Trying fallback…");
        } else if (e?.name === "NotAllowedError") {
          setHintText("Camera permission denied.");
        } else {
          setHintText("Unable to start camera.");
        }
      }
    };

    const handleHit = async (text: string) => {
      setHintText("Processing code…");
      try {
        const res = await fetch(`/api/batches/scan?code=${encodeURIComponent(text)}`);
        if (!res.ok) {
          throw new Error(await res.text().catch(() => "Unrecognized code"));
        }
        const data = await res.json();
        onBatchResolved(data); // show your batch summary + actions
        onOpenChange(false);
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Unrecognized code",
          description: "Scan a valid HortiTrack Data Matrix / QR code.",
        });
        // Restart scanner after brief pause
        setTimeout(() => {
          if (open) start();
        }, 600);
      }
    };

    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stop(); onOpenChange(v); }}>
      <DialogContent className="p-0 sm:max-w-[480px]">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Scan Batch Code</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-square w-full overflow-hidden rounded-b-lg">
          {/* live video */}
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
          {/* square overlay */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-[72%] w-[72%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {/* hint text */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-white">
            {hintText}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
