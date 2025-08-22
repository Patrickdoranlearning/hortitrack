
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from './ui/progress';
import { cn } from "@/lib/utils";
import type { Batch } from "@/lib/types";

type BatchCardProps = {
  batch: Batch;
  onOpen?: (batch: Batch) => void;
  actionsSlot?: React.ReactNode;
  className?: string;
};

export function BatchCard({
  batch,
  onOpen,
  actionsSlot,
  className,
}: BatchCardProps) {
  const stockPercentage =
    batch.initialQuantity > 0
      ? (batch.quantity / batch.initialQuantity) * 100
      : 0;

  const getStatusVariant = (
    status: Batch['status']
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'info' => {
    switch (status) {
      case 'Ready for Sale':
      case 'Looking Good':
        return 'accent';
      case 'Propagation':
      case 'Plugs/Liners':
        return 'info';
      case 'Potted':
        return 'default';
      case 'Archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div
      className={cn(
        "relative group rounded-2xl border bg-card text-card-foreground shadow-sm p-4 h-full",
        "hover:shadow-md transition-shadow",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-xl leading-tight">{batch.batchNumber}</div>
          {batch.plantVariety && <div className="text-sm line-clamp-1">{batch.plantVariety}</div>}
          <div className="text-xs text-muted-foreground">
            {[batch.plantFamily, batch.size].filter(Boolean).join(" • ") || " "}
          </div>
        </div>
        {/* Place actions here; they must stop propagation */}
        <div onClick={(e) => e.stopPropagation()} className="relative z-10">
          {actionsSlot}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-xs font-semibold">
          <span>Stock</span>
          <span>
            {batch.quantity.toLocaleString()} / {batch.initialQuantity.toLocaleString()}
          </span>
        </div>
      <Progress value={stockPercentage} className="mt-1" />


      {batch.status && (
        <Badge className="mt-3" variant={getStatusVariant(batch.status)}>
          {batch.status}
        </Badge>
      )}

      {/* Full-card overlay button to capture click & focus accessibly */}
      <button
        type="button"
        aria-label={`Open batch ${batch.batchNumber}`}
        className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/60 ring-offset-2"
        onClick={() => onOpen?.(batch)}
      />
    </div>
  );
}
