// NEW - client scanner
"use client";
import { useEffect, useRef, useState } from "react";

export default function ScannerClient({
  onDecoded,
}: { onDecoded: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [raw, setRaw] = useState<string>("");

  useEffect(() => {
    let stop = false;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function init() {
      workerRef.current = new Worker(new URL("../../workers/decoder.worker.ts", import.meta.url));
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      const vid = videoRef.current!;
      vid.srcObject = stream;
      await vid.play();

      canvas.width = vid.videoWidth;
      canvas.height = vid.videoHeight;

      const tick = () => {
        if (stop) return;
        try {
          ctx!.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
          workerRef.current!.onmessage = (ev: MessageEvent) => {
            if (ev.data?.ok) {
              const text = ev.data.result?.text as string;
              if (text) {
                setRaw(text);
                onDecoded(text);
              }
            }
          };
          workerRef.current!.postMessage({ type: "DECODE", data: { imageData }});
        } catch (_) {}
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    init().catch(console.error);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      const tracks = (videoRef.current?.srcObject as MediaStream | null)?.getTracks();
      tracks?.forEach(t => t.stop());
      workerRef.current?.terminate();
    };
  }, [onDecoded]);

  return (
    <div className="space-y-3">
      <video ref={videoRef} className="w-full rounded-xl bg-black/50" playsInline />
      <div className="text-sm text-muted-foreground">
        Raw: <span className="font-mono break-all">{raw || "—"}</span>
      </div>
    </div>
  );
}
