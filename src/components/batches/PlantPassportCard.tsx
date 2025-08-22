
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Clipboard, Leaf } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

type PassportDto = {
  batchId: string;
  aFamily: string | null;
  bProducerCode: string | null;
  cBatchNumber: string;
  dCountryCode: string | null;
  warnings: string[];
};

export function PlantPassportCard({ batchId }: { batchId: string }) {
  const [data, setData] = useState<PassportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/passport`, { cache: "no-store" });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(errBody.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as PassportDto;
        if (active) setData(json);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Failed to load passport");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false };
  }, [batchId]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!data) return <div className="text-sm text-muted-foreground">No passport data.</div>;

  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t) } catch {} };

  const Row = ({ code, label, value, copyable }:{
    code: "A"|"B"|"C"|"D"; label: string; value: string; copyable?: boolean;
  }) => (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-2 border-b last:border-b-0 border-black/10">
      <div className="font-semibold">{code})</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-serif text-base leading-tight">{value}</div>
      </div>
      {copyable ? (
        <Button size="icon" variant="ghost" aria-label={`Copy ${label}`} onClick={() => copy(value)}>
          <Clipboard className="h-4 w-4" />
        </Button>
      ) : <div/>}
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-4 w-4" aria-hidden /> EU Plant Passport
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          <Row code="A" label="Family" value={data.aFamily ?? "—"} copyable />
          <Row code="B" label="Producer Code" value={data.bProducerCode ?? "—"} copyable />
          <Row code="C" label="Batch No." value={data.cBatchNumber} copyable />
          <Row code="D" label="Country Code" value={data.dCountryCode ?? "IE"} />
        </div>
        {data.warnings?.length ? (
          <Alert className="mt-3">
            <AlertDescription>{data.warnings.join(" ")}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default PlantPassportCard;
