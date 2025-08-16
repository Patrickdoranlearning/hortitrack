"use client";

import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (text: string) => void;
};

export default function ScanAndActDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hintText, setHintText] = useState<string>("");

  // stability
  const lastTextRef = useRef<string>("");
  const sameCountRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);
  const stopReaderRef = useRef<() => void>();

  const stop = async () => {
    try { readerRef.current?.reset(); } catch {}
    readerRef.current = null;

    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
    } catch {}
    streamRef.current = null;

    try { stopReaderRef.current?.(); } catch {}
    stopReaderRef.current = undefined;
  };

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;

    const start = async () => {
      setHintText("Opening camera…");

      // ZXing hints — robust for DataMatrix and common prints
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.AZTEC,
        BarcodeFormat.PDF_417,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);     // small/low-contrast
      hints.set(DecodeHintType.ALSO_INVERTED, true);  // white-on-black
      hints.set(DecodeHintType.ASSUME_GS1, true);     // tolerates GS1/FNC1

      readerRef.current = new BrowserMultiFormatReader(hints, 150);

      // Prefer rear camera
      let deviceId: string | undefined;
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const rear = devices.find(d => /back|rear|environment/i.test(d.label || ""));
        deviceId = (rear || devices[0])?.deviceId;
      } catch {
        deviceId = undefined;
      }

      // Ask for 1080p; browsers downscale if needed; request continuous focus if supported
      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };
        // @ts-expect-error: advanced constraints are non-standard; safe to include
        (constraints.video as any).advanced = [{ focusMode: "continuous" }];

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setHintText(e?.name === "NotAllowedError" ? "Camera permission denied." : "Unable to start camera.");
        return;
      }

      setHintText("Hold steady over the DataMatrix / QR label…");

      // reset stability
      lastTextRef.current = "";
      sameCountRef.current = 0;
      cooldownRef.current = false;

      // Continuous decode
      const reader = readerRef.current!;
      let stopped = false;
      stopReaderRef.current = () => { stopped = true; };

      reader
        .decodeFromVideoDevice(deviceId, videoRef.current!, (result, _err) => {
          if (stopped || cancelled) return;
          if (!result) return; // ignore frequent transient errors

          const raw = String(result.getText() || "").trim();
          if (!raw) return;

          // Require two identical reads to avoid jumpiness
          if (raw === lastTextRef.current) {
            sameCountRef.current += 1;
          } else {
            lastTextRef.current = raw;
            sameCountRef.current = 1;
          }

          if (!cooldownRef.current && sameCountRef.current >= 2) {
            cooldownRef.current = true;
            try { navigator.vibrate?.(50); } catch {}
            onDetected(raw);
            onOpenChange(false); // keep pop-up UX
            setTimeout(() => { cooldownRef.current = false; }, 1000);
          }
        })
        .catch(() => {
          setHintText("Scanner error. Close and reopen the scanner.");
        });
    };

    start();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan code</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black">
          {/* live video */}
          <video
            ref={videoRef}
            className="block w-full max-w-full rounded-xl bg-black object-cover"
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
            {hintText || "Aim at the label and hold steady"}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
