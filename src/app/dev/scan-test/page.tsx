
"use client";
import { useState } from "react";

const samples = [
  "/test-barcodes/dm_small.png",
  "/test-barcodes/dm_inverted.png",
  "/test-barcodes/qr_basic.png",
  "/test-barcodes/gs1_dm_fnc1.png",
];

export default function DevScanTestPage() {
  const [out, setOut] = useState<any>(null);

  async function tryDecode(url: string) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("load-failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const worker = new Worker(new URL("@/workers/decoder.worker.ts", import.meta.url), { type: "module" });
    const result = await new Promise((resolve, reject) => {
      worker.onmessage = (ev: MessageEvent) => {
        const { ok, result, error } = ev.data || {};
        worker.terminate();
        if (ok && result?.text) resolve(result);
        else reject(new Error(error || "decode-failed"));
      };
      worker.postMessage({ type: "DECODE", imageData }, [imageData.data.buffer]);
    });
    setOut({ url, result });
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-display">Scan Test</h1>
      <div className="grid grid-cols-2 gap-4">
        {samples.map((s) => (
          <button key={s} onClick={() => tryDecode(s)} className="rounded border p-2 hover:bg-muted">
            {s}
          </button>
        ))}
      </div>
      <pre className="rounded bg-muted p-3 text-xs">{JSON.stringify(out, null, 2)}</pre>
    </div>
  );
}
