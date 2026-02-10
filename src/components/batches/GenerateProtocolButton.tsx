"use client";

import * as React from "react";

export function GenerateProtocolButton({ batchId, defaultName }: { batchId: string; defaultName?: string }) {
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    const name = defaultName || `Protocol – ${new Date().toISOString().slice(0,10)}`;
    setBusy(true);
    try {
      const res = await fetch("/api/protocols/generate?download=pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/pdf" },
        body: JSON.stringify({ batchId, publish: true, name }),
      });
      if (!res.ok) {
        const txt = await res.text();
        let msg = "Failed to generate protocol";
        try { msg = (JSON.parse(txt).error as string) || msg; } catch { msg = txt || msg; }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^\w\-]+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Generate failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 transition text-sm"
    >
      {busy ? "Generating…" : "Generate Protocol (PDF)"}
    </button>
  );
}
