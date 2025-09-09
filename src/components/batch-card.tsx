
"use client";

import * as React from "react";
import { useState } from "react";
import {
  Card
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from './ui/progress';
import { cn } from "@/lib/utils";
import type { Batch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TransplantForm from "@/components/batches/TransplantForm";
import EditBatchForm from "@/components/batches/EditBatchForm";
import EventsCard from "@/components/batches/EventsCard";
import PassportsCard from "@/components/batches/PassportsCard";
import AncestryCard from "@/components/batches/AncestryCard";
import MoveForm from "@/components/batches/actions/MoveForm";
import StatusForm from "@/components/batches/actions/StatusForm";
import DumpForm from "@/components/batches/actions/DumpForm";

// --- runtime guard: logs undefined imports without crashing ---
const _ensure = (x: any, name: string) => {
  if (!x) {
    // This will tell you exactly which component is undefined
    console.error(`[BatchCard] ${name} is undefined (import/export mismatch)`);
    // render no-op to avoid crash
    return ((_: any) => null) as any;
  }
  return x;
};

// Wrap likely suspects
const SafeTransplantForm = _ensure(TransplantForm, "TransplantForm");
const SafeEditBatchForm = _ensure(EditBatchForm, "EditBatchForm");
const SafeEventsCard = _ensure(EventsCard, "EventsCard");
const SafePassportsCard = _ensure(PassportsCard, "PassportsCard");
const SafeAncestryCard = _ensure(AncestryCard, "AncestryCard");


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
  const [open, setOpen] = useState(false);
  const parentSummary = {
    id: (batch as any).id,
    batch_number: batch.batchNumber,
    quantity: batch.quantity ?? 0,
    plant_variety_id: (batch as any).plant_variety_id,
    supplier_id: (batch as any).supplier_id ?? null,
  };

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
        <div onClick={(e) => e.stopPropagation()} className="relative z-10 flex items-center gap-2">
          {actionsSlot}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="default">Transplant</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" aria-describedby="transplant-desc">
              <DialogHeader>
                <DialogTitle>Transplant from {batch.batchNumber}</DialogTitle>
                <p id="transplant-desc" className="text-sm text-muted-foreground">
                  Create a new batch from this parent. Full trays/pots only.
                </p>
              </DialogHeader>
              <SafeTransplantForm
                parentBatchId={parentSummary.id}
                onCreated={() => { setOpen(false); /* trigger refresh */ }}
              />
            </DialogContent>
          </Dialog>
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
