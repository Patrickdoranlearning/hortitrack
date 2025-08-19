"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertTriangle } from "lucide-react";

type PassportDto = {
  aFamily: string | null;
  bProducerCode: string | null;
  cBatchNumber: string;
  dCountryCode: string | null;
  warnings: string[];
};

export function PlantPassportCard({ batchId }: { batchId: string }) {
  const [data, setData] = useState<PassportDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!batchId) {
      setLoading(false);
      setErr("Batch ID is missing.");
      return;
    };

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/batches/${batchId}/passport`, { cache: "no-store" });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({error: `HTTP ${res.status}`}));
            throw new Error(errBody.error);
        }
        const json = await res.json();
        if (active) setData(json);
      } catch (e: any) {
        if (active) setErr(e.message ?? "Failed to load passport");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [batchId]);

  if (loading) return <div className="p-4 space-y-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></div>;
  if (err) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Could not load passport</AlertTitle><AlertDescription>{err}</AlertDescription></Alert>;
  if (!data) return null;

  return (
    <div className="rounded-2xl border bg-card text-card-foreground p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Plant Passport</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="A — Family">{data.aFamily ?? <em className="text-muted-foreground">not set</em>}</Field>
        <Field label="B — Producer Code">{data.bProducerCode ?? <em className="text-muted-foreground">not set</em>}</Field>
        <Field label="C — Batch Number">{data.cBatchNumber}</Field>
        <Field label="D — Country Code">{data.dCountryCode ?? <em className="text-muted-foreground">not set</em>}</Field>
      </div>
      {!!data.warnings?.length && (
        <ul className="mt-2 list-disc list-inside text-amber-600 text-sm">
          {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-md bg-muted/50 p-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
