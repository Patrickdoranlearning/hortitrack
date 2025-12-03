
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TransplantForm from "@/components/batches/TransplantForm";
import EditBatchForm from "@/components/batches/EditBatchForm";
import EventsCard from "@/components/batches/EventsCard";
import PassportsCard from "@/components/batches/PassportsCard";
import AncestryCard from "@/components/batches/AncestryCard";
import MoveForm from "@/components/batches/actions/MoveForm";
import StatusForm from "@/components/batches/actions/StatusForm";
import DumpForm from "@/components/batches/actions/DumpForm";
import { TransplantIcon } from "@/components/icons";
import { ActionMenuButton } from "@/components/actions/ActionMenuButton";
import type { ActionMode } from "@/components/actions/types";

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
  onLogAction?: (batch: Batch, mode: ActionMode) => void;
  actionsSlot?: React.ReactNode;
  className?: string;
};

export function BatchCard({
  batch,
  onOpen,
  onLogAction,
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
  const locationLabel =
    typeof batch.location === "string"
      ? batch.location
      : (batch as any)?.location?.name ??
        (batch as any)?.locationName ??
        "Unassigned";
  const supplierLabel =
    (batch as any)?.supplier ??
    (batch as any)?.supplierName ??
    (batch as any)?.supplier_name ??
    "Unassigned";

  return (
    <div
      className={cn(
        "relative group rounded-2xl border bg-card text-card-foreground shadow-sm p-4 h-full flex flex-col",
        "hover:shadow-md transition-shadow",
        className
      )}

    >
      <div className="flex-1 space-y-3">
        {/* Action bar */}
        <TooltipProvider>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2"
          >
            {actionsSlot}
            {onLogAction && (
              <ActionMenuButton
                batch={batch}
                onSelect={(mode) => onLogAction(batch, mode)}
                variant="secondary"
                size="sm"
                className="sm:px-3"
                hideLabelOnMobile
              />
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="sm:px-3" aria-label="Transplant">
                  <TransplantIcon />
                  <span className="hidden sm:inline ml-2">Transplant</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Transplant from {batch.batchNumber}</DialogTitle>
                  <DialogDescription>
                    {batch.plantVariety ? `${batch.plantVariety}` : "Create a new batch from this parent."}
                    {typeof batch.quantity === "number" ? ` • ${batch.quantity.toLocaleString()} units remaining` : ""}
                  </DialogDescription>
                </DialogHeader>
                <SafeTransplantForm
                  parentBatchId={parentSummary.id}
                  onCreated={() => {
                    setOpen(false); /* trigger refresh */
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </TooltipProvider>

        {/* Core batch info */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-serif text-xl leading-tight">
                {batch.plantVariety || batch.batchNumber}
              </div>
              {batch.plantFamily && (
                <div className="text-sm text-muted-foreground line-clamp-1">
                  {batch.plantFamily}
                </div>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              {batch.batchNumber}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {[batch.size, batch.phase?.toString()?.replace(/_/g, " ")].filter(Boolean).join(" • ") || " "}
          </div>
        </div>

        {/* Location & supplier */}
        <div className="rounded-xl bg-muted/40 p-3 text-xs sm:text-sm grid gap-2">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground uppercase tracking-wide text-[10px] sm:text-xs">Location</span>
            <span className="font-medium text-right">{locationLabel}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground uppercase tracking-wide text-[10px] sm:text-xs">Supplier</span>
            <span className="font-medium text-right">{supplierLabel}</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold">
            <span>Stock</span>
            <span>
              {(batch.quantity ?? 0).toLocaleString()} / {(batch.initialQuantity ?? 0).toLocaleString()}
            </span>
          </div>
          <Progress value={stockPercentage} className="mt-1" />
        </div>

        <div className="flex flex-wrap gap-1">
          {phase && (
            <Badge variant="secondary" className="capitalize">{phase}</Badge>
          )}
          {batch.status && (
            <Badge variant={getStatusVariant(batch.status)}>
              {batch.status}
            </Badge>
          )}
        </div>
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
