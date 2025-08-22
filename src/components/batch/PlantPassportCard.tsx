"use client";

import * as React from "react";
import { PlantPassport } from "@/types/batch";
import { Button } from "@/components/ui/button";
import { Copy, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  passport: PlantPassport | null;      // pass null to hide nicely
  className?: string;
  onPrint?: () => void;
  onCopy?: () => void;
};

export function PlantPassportCard({ passport, className, onPrint, onCopy }: Props) {
  if (!passport) return null;

  const A = passport.A_botanicalName || "—";
  const B = passport.B_regNumber || "—";
  const C = passport.C_traceabilityCode || "—";
  const D = passport.D_countryOfOrigin || "—";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card text-card-foreground shadow-sm p-4",
        className
      )}
      data-testid="plant-passport-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="h-5 w-7 rounded-sm"
            style={{ background:
              "radial-gradient(circle at 50% 50%, #F7C948 2px, #1B4DB1 3px) repeat, #1B4DB1",
              backgroundSize: "8px 8px" }}
            title="EU Flag (stylised)"
          />
          <div className="text-sm font-medium tracking-tight">EU Plant Passport</div>
        </div>

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy passport details"
            onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Print passport card"
            onClick={(e) => { e.stopPropagation(); onPrint?.(); }}
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[24px_1fr] gap-y-1.5 text-sm">
        <div className="font-semibold">A</div>
        <div className="font-serif">{A}</div>

        <div className="font-semibold">B</div>
        <div>{B}</div>

        <div className="font-semibold">C</div>
        <div className="font-mono">{C}</div>

        <div className="font-semibold">D</div>
        <div>{D}</div>
      </div>
    </div>
  );
}
