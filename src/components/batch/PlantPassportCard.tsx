// src/components/batch/PlantPassportCard.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, Clipboard } from "lucide-react";

type Props = {
  family?: string | null;
  producerCode?: string | null;
  batchNumber: string;
  countryCode?: string | null;
  status?: string | null;
  source?: "Supplier" | "Internal";
  hasHistoryLink?: boolean;
  onOpenHistory?: () => void;
};

export function PlantPassportCard({
  family,
  producerCode,
  batchNumber,
  countryCode,
  source = "Internal",
  hasHistoryLink,
  onOpenHistory,
}: Props) {
  const A = family ?? "—";
  const B = producerCode ?? "—";
  const C = batchNumber;
  const D = countryCode ?? "IE";
  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  const Row = (p:{code:"A"|"B"|"C"|"D"; label:string; value:string; copyable?:boolean}) => (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-2 border-b last:border-b-0 border-border">
      <div className="font-semibold">{p.code})</div>
      <div>
        <div className="text-xs text-muted-foreground">{p.label}</div>
        <div className="font-serif text-base leading-tight">{p.value}</div>
      </div>
      {p.copyable ? (
        <Button size="icon" variant="ghost" onClick={()=>copy(p.value)} aria-label={`Copy ${p.label}`}>
          <Clipboard className="h-4 w-4" />
        </Button>
      ) : <div/>}
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="py-3 flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-4 w-4" /> Plant Passport
        </CardTitle>
        <Badge variant={source === "Supplier" ? "secondary" : "default"}>{source}</Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          <Row code="A" label="Family" value={A} copyable />
          <Row code="B" label="Producer Code" value={B} copyable />
          <Row code="C" label="Supplier Batch No." value={C} copyable />
          <Row code="D" label="Country Code" value={D} />
        </div>
        {source === "Supplier" ? (
          <div className="text-xs text-muted-foreground mt-2">
            Supplier passport applies until transplant or 12 weeks.
          </div>
        ) : null}
        {hasHistoryLink ? (
          <div className="mt-2">
            <Button variant="link" size="sm" onClick={onOpenHistory}>View historical supplier passport</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
