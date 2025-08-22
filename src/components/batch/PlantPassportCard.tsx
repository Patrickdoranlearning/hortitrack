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
  status?: string | null;               // to gray when archived
  className?: string;
  defaultProducerCode?: string;         // fallback for B
  defaultCountryCode?: string;          // fallback for D
};

export function PlantPassportCard({
  family,
  producerCode,
  batchNumber,
  countryCode,
  status,
  className,
  defaultProducerCode = "IE2727 Doran Nurseries Producer Code",
  defaultCountryCode = "IE",
}: Props) {
  const { toast } = useToast();

  const A = (family && family.trim()) || "—";
  const B = (producerCode && producerCode.trim()) || defaultProducerCode;
  const C = batchNumber;
  const D = (countryCode && countryCode.trim()) || defaultCountryCode;

  const isArchived = (status ?? "").toLowerCase().includes("archiv");

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: `Couldn’t copy ${label}`, variant: "destructive" })
    );
  }

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
      <div className="pl-2">
        {canCopy ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Copy ${label}`}
            onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        "rounded-2xl border shadow-sm",
        "bg-[#E5E8E3] text-foreground",
        isArchived && "opacity-80",
        className
      )}
      data-testid="plant-passport-card"
    >
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium tracking-tight">
            Plant Passport
          </CardTitle>
          <Leaf aria-hidden className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1">
          <Row code="A" label="Family" value={A} />
          <Row
            code="B"
            label="Producer Code"
            value={B}
            canCopy
            onCopy={() => copy(B, "Producer Code")}
          />
          <Row
            code="C"
            label="Batch No."
            value={C}
            canCopy
            onCopy={() => copy(C, "Batch No.")}
          />
          <Row code="D" label="Country Code" value={D} />
        </div>
      </CardContent>
    </Card>
  );
}
