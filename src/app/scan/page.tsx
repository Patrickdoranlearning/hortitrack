// NEW
"use client";
import ScannerClient from "@/components/Scanner/ScannerClient";
import { useState } from "react";

export default function ScanPage() {
  const [status, setStatus] = useState<"idle"|"found"|"not_found"|"error">("idle");
  const [decoded, setDecoded] = useState<string>("");

  async function handleDecoded(value: string) {
    // Debounce identical reads
    if (value === decoded) return;
    setDecoded(value);

    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(value)}`);
      if (res.ok) {
        const batch = await res.json();
        setStatus("found");
        // TODO: route to batch detail
        console.log("Batch", batch);
      } else {
        setStatus("not_found");
      }
    } catch (e) {
      setStatus("error");
    }
  }

  return (
    <main className="p-4 md:p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Scan Batch Code</h1>
      <ScannerClient onDecoded={handleDecoded} />
      <div className="rounded-lg p-3 border">
        <div className="text-sm">Status: <b>{status}</b></div>
        <div className="text-sm">Last value:</div>
        <div className="font-mono text-sm break-all">{decoded || "—"}</div>
      </div>
    </main>
  );
}
