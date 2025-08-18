"use client";
import * as React from "react";

export function GenerateHistoryPdfButton({ batchId }: { batchId: string }) {
  const [busy, setBusy] = React.useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/history/pdf`, { method: "POST" });
      if (!res.ok) {
        const t = await res.text(); throw new Error(t);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Batch_History_${batchId}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={onClick} disabled={busy} className="px-3 py-2 rounded-lg border text-sm">
      {busy ? "Exporting…" : "Export History (PDF)"}
    </button>
  );
}
