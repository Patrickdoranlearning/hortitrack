
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
  console.log("BatchCard received batch:", batch); // Added console log

  const stockPercentage =
    (batch.initialQuantity ?? 0) > 0
      ? ((batch.quantity ?? 0) / (batch.initialQuantity ?? 0)) * 100
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

  const phase = batch.phase;

  return (
    <div
      className={cn(
        "relative group rounded-2xl border bg-card text-card-foreground shadow-sm p-4 h-full flex flex-col",
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

      <div className="mt-2 flex-grow">
        <div className="flex justify-between text-xs font-semibold">
            <span>Stock</span>
            <span>
              {(batch.quantity ?? 0).toLocaleString()} / {(batch.initialQuantity ?? 0).toLocaleString()}
            </span>
          </div>
        <Progress value={stockPercentage} className="mt-1" />
      </div>


      <div className="flex flex-wrap gap-1 mt-3">
        {phase && (
            <Badge variant="secondary" className="capitalize">{phase}</Badge>
        )}
        {batch.status && (
          <Badge variant={getStatusVariant(batch.status)}>
            {batch.status}
          </Badge>
        )}
      </div>

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
