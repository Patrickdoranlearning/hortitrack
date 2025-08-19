
"use client";
import { useRef, useState } from "react";
import ScannerClient from "@/components/Scanner/ScannerClient";
import { getIdTokenOrNull } from "@/lib/auth/client";
import { track } from "@/lib/telemetry";
import { useToast } from "@/hooks/use-toast";

export default function ScanPage() {
  const [status, setStatus] = useState<"idle" | "found" | "not_found" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const inflight = useRef(false);

  async function lookup(code: string) {
    if (inflight.current) return;
    inflight.current = true;
    setStatus("idle"); // reset status for new lookup

    try {
        const idToken = await getIdTokenOrNull();
        if (!idToken) {
            setStatus("error");
            toast({ variant: "destructive", title: "Authentication Error", description: "Please sign in to look up batches." });
            return;
        }

        const res = await fetch("/api/batches/scan", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ code }),
        });

        if (res.ok) {
            const { batch, summary } = await res.json();
            setStatus("found");
            track("scan_lookup_result", { result: "found", by: summary?.by ?? "unknown" });
            toast({ title: "Batch Found", description: `#${batch.batchNumber} - ${batch.plantVariety}` });
            // TODO: navigate/show batch details
            console.log("Batch found:", batch);
        } else if (res.status === 404) {
            setStatus("not_found");
            track("scan_lookup_result", { result: "not_found" });
            toast({ variant: "destructive", title: "Not Found", description: "No batch found for the scanned code." });
        } else if (res.status === 422) {
            setStatus("error");
            toast({ variant: "destructive", title: "Invalid Code", description: "The scanned code was not recognized." });
        } else {
            setStatus("error");
            track("scan_lookup_result", { result: "error", status: res.status });
            toast({ variant: "destructive", title: "API Error", description: `An error occurred (${res.status}).` });
        }
    } catch (e: any) {
        setStatus("error");
        track("scan_lookup_result", { result: "error", message: e?.message });
        toast({ variant: "destructive", title: "Network Error", description: "Could not connect to the server." });
    } finally {
        inflight.current = false;
    }
  }

  function onDecoded(text: string) {
    lookup(text);
  }

  async function decodeImageFile(file: File): Promise<string> {
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
    } catch (err: any) {
      setStatus("error");
      toast({ variant: 'destructive', title: 'Decode Failed', description: 'Could not decode the uploaded image.' });
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  async function onManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const v = (formData.get("code") || "").toString().trim();
    if (!v) return;
    lookup(v);
  }

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <h1 className="text-2xl font-display">Scan Batch</h1>
      <ScannerClient onDecoded={onDecoded} />
      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={onUploadChange} className="text-sm"/>
        <form onSubmit={onManualSubmit} className="flex items-center gap-2">
          <input name="code" className="rounded-md border px-3 py-1 text-sm" placeholder="Enter code manually" />
          <button type="submit" className="rounded-md border px-3 py-1 text-sm">Go</button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">Status: {status}</p>
    </div>
  );
}

