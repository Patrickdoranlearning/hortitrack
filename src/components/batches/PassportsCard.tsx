"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";

type PassportRow = {
  id: string;
  passport_type: "supplier" | "internal";
  operator_reg_no: string | null;
  traceability_code: string | null;
  origin_country: string | null;
  created_at: string;
  images?: any;
};

export default function PassportsCard({ batchId }: { batchId: string }) {
  const [items, setItems] = React.useState<PassportRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`/api/production/batches/${batchId}/passports`);
        const j = await r.json();
        if (!cancel) {
          if (!r.ok) throw new Error(j?.error || r.statusText);
          setItems(j.items || []);
        }
      } catch (e: any) { if (!cancel) setErr(e?.message ?? String(e)); }
    })();
    return () => { cancel = true; };
  }, [batchId]);

  const currentIdx = 0; // newest first

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold">Plant Passports</div>
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="space-y-2">
        {items.length === 0 && <div className="text-sm text-muted-foreground">No passports recorded.</div>}

        {items.map((pp, idx) => (
          <div key={pp.id} className={`rounded-md border p-3 ${idx === currentIdx ? "border-green-400" : ""}`}>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="font-medium capitalize">{pp.passport_type}</span>
              {idx === currentIdx && <span className="text-green-700 font-medium">Current</span>}
              <span className="text-muted-foreground">{new Date(pp.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div><span className="text-muted-foreground">Operator:</span> {pp.operator_reg_no || "—"}</div>
              <div><span className="text-muted-foreground">Traceability:</span> {pp.traceability_code || "—"}</div>
              <div><span className="text-muted-foreground">Origin:</span> {pp.origin_country || "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
