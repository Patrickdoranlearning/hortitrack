
"use client";
import { useRef, useState } from "react";
import ScannerClient from "@/components/Scanner/ScannerClient";
import { getIdTokenOrNull } from "@/lib/auth/client";
import { track } from "@/lib/telemetry";

export default function ScanPage() {
  const [status, setStatus] = useState<"idle"|"found"|"not_found"|"error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function lookup(code: string) {
    const idToken = await getIdTokenOrNull();
    const res = await fetch("/api/batches/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const { batch, summary } = await res.json();
      setStatus("found");
      track("scan_lookup_result", { result: "found", by: summary?.by ?? "unknown" });
      // TODO: navigate/show batch; keep your existing pattern here
      console.log("Batch found:", batch);
    } else if (res.status === 404) {
      setStatus("not_found");
      track("scan_lookup_result", { result: "not_found" });
    } else {
      setStatus("error");
      track("scan_lookup_result", { result: "error", status: res.status });
    }
  }

  function onDecoded(text: string) {
    lookup(text);
  }

  async function decodeImageFile(file: File) {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    ctx.drawImage(bmp, 0, 0);
    const imageData = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const worker = new Worker(new URL("@/workers/decoder.worker.ts", import.meta.url), { type: "module" });
    const res: string = await new Promise((resolve, reject) => {
      worker.onmessage = (ev: MessageEvent) => {
        const { ok, result, error } = ev.data || {};
        worker.terminate();
        if (ok && result?.text) resolve(result.text);
        else reject(new Error(error || "decode-failed"));
      };
      worker.postMessage({ type: "DECODE", imageData }, [imageData.data.buffer]);
    });
    return res;
  }

  async function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await decodeImageFile(f);
      onDecoded(text);
    } catch {
      setStatus("error");
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  async function onManualSubmit(formData: FormData) {
    const v = (formData.get("code") || "").toString().trim();
    if (!v) return;
    lookup(v);
  }

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <h1 className="text-2xl font-display">Scan Batch</h1>
      <ScannerClient onDecoded={onDecoded} />
      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={onUploadChange} />
        <form action={onManualSubmit} className="flex items-center gap-2">
          <input name="code" className="rounded-md border px-3 py-1" placeholder="Enter code manually" />
          <button className="rounded-md border px-3 py-1">Go</button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">Status: {status}</p>
    </div>
  );
}
