"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Camera } from "lucide-react";
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
} from "@zxing/library";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** called with raw decoded string when a code is recognized */
  onDetected: (text: string) => void;
};

export default function ScanAndActDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<
    "idle" | "init" | "ready" | "scanning" | "noresult" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const hints = useMemo(() => {
    const h = new Map();
    h.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE]);
    return h;
  }, []);

  useEffect(() => {
    if (!open) return;
    setStatus("init");
    setErrorMsg("");

    // enumerate cameras AFTER permission (labels are empty until then on many browsers)
    async function init() {
      try {
        // try to get a stream quickly (relaxed constraints), this triggers permission prompt
        const warmup = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        warmup.getTracks().forEach(t => t.stop());

        const all = (await navigator.mediaDevices.enumerateDevices())
          .filter(d => d.kind === "videoinput");

        setDevices(all);

        // prefer a back/environment camera on mobile
        const back = all.find(d => /back|rear|environment/i.test(d.label));
        const firstId = back?.deviceId ?? all[0]?.deviceId;

        setDeviceId(prev => prev ?? firstId);
        setStatus(all.length ? "ready" : "error");
        if (!all.length) setErrorMsg("No cameras found.");

      } catch (err: any) {
        console.error(err);
        setStatus("error");
        setErrorMsg(err?.name === "NotAllowedError"
          ? "Camera permission denied."
          : err?.message || "Failed to initialize camera.");
      }
    }

    init();
  }, [open]);

  useEffect(() => {
    // start decoding when ready + we have a deviceId
    if (!(open && status === "ready" && deviceId && videoRef.current)) return;

    const video = videoRef.current;
    let stopped = false;

    async function start() {
      try {
        setStatus("scanning");

        // start chosen device
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
        video.setAttribute("playsinline", "true");
        video.muted = true;
        video.srcObject = stream;
        await video.play();

        // ZXing reader
        const reader = new BrowserMultiFormatReader(hints, 500);
        codeReaderRef.current = reader;

        let gotResult = false;
        reader.decodeFromVideoDevice(deviceId, video, (result, err) => {
          if (stopped) return;
          if (result) {
            gotResult = true;
            // clean up immediately so the dialog can close
            teardown();
            onDetected(result.getText());
          }
          // ignore intermittent decode errors while scanning
        });

        // soft timeout to show “no code yet” hint
        setTimeout(() => {
          if (!gotResult && !stopped) setStatus("noresult");
        }, 2000);

      } catch (err: any) {
        console.error(err);
        setStatus("error");
        setErrorMsg(err?.message || "Could not open selected camera.");
      }
    }

    start();

    function teardown() {
      stopped = true;
      try {
        codeReaderRef.current?.reset();
      } catch {}
      codeReaderRef.current = null;
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
    }

    return teardown;
  }, [open, status, deviceId, hints, onDetected]);

  // when modal closes, ensure we fully stop the camera
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      try {
        codeReaderRef.current?.reset();
      } catch {}
      codeReaderRef.current = null;
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
      setStatus("idle");
      setErrorMsg("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Scan Batch Code
          </DialogTitle>
          <DialogDescription>
            Point your camera at a <b>Data&nbsp;Matrix</b> or QR code. We’ll detect it automatically.
          </DialogDescription>
        </DialogHeader>

        {/* camera picker */}
        {devices.length > 1 && (
          <div className="px-4 pb-2">
            <Select value={deviceId ?? ""} onValueChange={setDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose camera" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d, i) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* video */}
        <div className="relative aspect-[3/4] w-full bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" />
          {/* overlay mask / status */}
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
            <div className="mb-3 rounded bg-black/40 px-3 py-1 text-xs text-white">
              {status === "init" && "Initializing camera…"}
              {status === "ready" && "Starting scanner…"}
              {status === "scanning" && "Scanning… hold steady"}
              {status === "noresult" && "Still looking… try more light or move closer"}
              {status === "error" && errorMsg}
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
