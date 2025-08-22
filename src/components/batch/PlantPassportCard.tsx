
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type Props = {
  family?: string | null;               // A
  producerCode?: string | null;         // B
  batchNumber: string;                  // C
  countryCode?: string | null;          // D
  status?: string | null;               // used to gray when archived
};

export function PlantPassportCard({
  family,
  producerCode,
  batchNumber,
  countryCode,
  status,
}: Props) {
  const { toast } = useToast();

  const A = family ?? "—";
  const B = producerCode ?? "—";
  const C = batchNumber;
  const D = countryCode ?? "IE";

  const isArchived = (status ?? "").toLowerCase() === "archived";

  const copy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast({ title: `${label} copied`, description: text });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const Row = ({
    code,
    label,
    value,
    canCopy,
    onCopy,
  }: {
    code: "A" | "B" | "C" | "D";
    label: string;
    value: string;
    canCopy?: boolean;
    onCopy?: () => void;
  }) => (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-2 border-b last:border-b-0 border-black/10">
      <div className="font-semibold">{code})</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-serif text-base leading-tight">{value}</div>
      </div>
      {canCopy && value !== "—" ? (
        <Button size="icon" variant="ghost" aria-label={`Copy ${label}`} onClick={onCopy}>
          <Clipboard className="h-4 w-4" />
        </Button>
      ) : (
        <div />
      )}
    </div>
  );

  return (
    <Card className={cn("border-2", isArchived && "opacity-60")}>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-4 w-4" aria-hidden />
          EU Plant Passport
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          <Row code="A" label="Family" value={A} canCopy onCopy={() => copy(A, "Family")} />
          <Row code="B" label="Producer Code" value={B} canCopy onCopy={() => copy(B, "Producer Code")} />
          <Row code="C" label="Batch No." value={C} canCopy onCopy={() => copy(C, "Batch No.")} />
          <Row code="D" label="Country Code" value={D} />
        </div>
      </CardContent>
    </Card>
  );
}

export default PlantPassportCard;
