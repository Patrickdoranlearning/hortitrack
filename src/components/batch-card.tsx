
"use client";

import * as React from "react";
import { useState } from "react";
import {
  Card
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from './ui/progress';
import { SimpleDistributionBar } from "./InteractiveDistributionBar";
import type { SimpleDistribution } from "@/lib/history-types";
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
import { PlayCircle, Truck } from "lucide-react";
import { ActualizeBatchDialog } from "@/components/batches/ActualizeBatchDialog";

// --- runtime guard: logs undefined imports without crashing ---
const _ensure = <T,>(x: T | undefined | null, name: string): T => {
  if (!x) {
    console.error(`[BatchCard] ${name} is undefined (import/export mismatch)`);
    return (() => null) as unknown as T;
  }
  return x;
};

// Wrap likely suspects
const SafeTransplantForm = _ensure(TransplantForm, "TransplantForm");
const SafeEditBatchForm = _ensure(EditBatchForm, "EditBatchForm");
const SafeEventsCard = _ensure(EventsCard, "EventsCard");
const SafePassportsCard = _ensure(PassportsCard, "PassportsCard");
const SafeAncestryCard = _ensure(AncestryCard, "AncestryCard");

// Extended batch type to handle both camelCase and snake_case from different data sources
type BatchCardBatch = Batch & {
  // These fields may come in snake_case from raw database queries
  id?: string;
  plant_variety_id?: string;
  plant_family?: string;
  supplier_id?: string | null;
  supplier_name?: string;
  supplier?: string;
  supplierName?: string;
  locationName?: string;
  // Distribution data from v_batch_search view
  distribution?: SimpleDistribution;
};

type BatchCardProps = {
  batch: BatchCardBatch;
  onOpen?: (batch: BatchCardBatch) => void;
  onLogAction?: (batch: BatchCardBatch, mode: ActionMode) => void;
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
  const [actualizeOpen, setActualizeOpen] = useState(false);

  const parentSummary = {
    id: batch.id,
    batch_number: batch.batchNumber,
    quantity: batch.quantity ?? 0,
    plant_variety_id: batch.plant_variety_id ?? batch.plantVarietyId,
    supplier_id: batch.supplier_id ?? batch.supplierId ?? null,
  };

  // Check if this is a planned or incoming batch
  const isPlanned = batch.status === "Planned";
  const isIncoming = batch.status === "Incoming";
  const isGhostBatch = isPlanned || isIncoming;

  // Use inline distribution from batch data (no API call needed!)
  // Fallback for ghost batches or if distribution is not available
  const distribution: SimpleDistribution = React.useMemo(() => {
    // Use inline distribution data if available (from v_batch_search view)
    if (batch.distribution) {
      return batch.distribution;
    }

    // Fallback for ghost batches or legacy data without distribution
    const qty = batch.quantity ?? 0;
    const reservedForPotting = batch.reservedQuantity ?? 0;
    return {
      available: Math.max(0, qty - reservedForPotting),
      allocatedPotting: reservedForPotting,
      allocatedSales: 0,
      sold: 0,
      dumped: 0,
      transplanted: 0,
      totalAccounted: qty,
    };
  }, [batch.distribution, batch.quantity, batch.reservedQuantity]);

  const familyLabel =
    batch.plantFamily ||
    batch.plant_family ||
    "Unspecified";
  const getStatusVariant = (
    status: Batch['status']
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'info' => {
    switch (status) {
      case 'Incoming':
        return 'secondary';
      case 'Planned':
        return 'outline';
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
      : (batch.location as { name?: string })?.name ??
        batch.locationName ??
        "Unassigned";
  const supplierLabel =
    batch.supplier ??
    batch.supplierName ??
    batch.supplier_name ??
    "Unassigned";

  return (
    <div
      className={cn(
        "relative group rounded-2xl border bg-card text-card-foreground shadow-sm p-4 h-full flex flex-col",
        "hover:shadow-md transition-shadow",
        // Visual distinction for planned/incoming batches
        isPlanned && "border-dashed border-2 border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10",
        isIncoming && "border-dashed border-2 border-blue-400/60 bg-blue-50/30 dark:bg-blue-950/10",
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
            {/* Show Actualize button for planned/incoming batches */}
            {isGhostBatch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isIncoming ? "default" : "secondary"}
                    size="sm"
                    className="sm:px-3"
                    onClick={() => setActualizeOpen(true)}
                  >
                    {isIncoming ? <Truck className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    <span className="hidden sm:inline ml-2">
                      {isIncoming ? "Receive" : "Actualize"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isIncoming 
                    ? "Mark this incoming stock as received and start production"
                    : "Convert this planned batch to an active production batch"
                  }
                </TooltipContent>
              </Tooltip>
            )}
            {onLogAction && !isGhostBatch && (
              <ActionMenuButton
                batch={batch}
                onSelect={(mode) => onLogAction(batch, mode)}
                variant="secondary"
                size="sm"
                className="sm:px-3"
                hideLabelOnMobile
              />
            )}
            {!isGhostBatch && (
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
            )}
          </div>
        </TooltipProvider>
        
        {/* Actualize dialog for ghost batches */}
        {isGhostBatch && (
          <ActualizeBatchDialog
            open={actualizeOpen}
            onOpenChange={setActualizeOpen}
            batch={batch}
            onSuccess={() => {
              setActualizeOpen(false);
              // Trigger a refresh - the parent should handle this
            }}
          />
        )}

        {/* Core batch info */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-serif text-xl leading-tight">
                {batch.plantVariety || batch.batchNumber}
              </div>
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              {batch.batchNumber}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {[familyLabel, batch.size, batch.phase?.toString()?.replace(/_/g, " ")].filter(Boolean).join(" • ") || " "}
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
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span>Stock</span>
            <span>
              {(batch.quantity ?? 0).toLocaleString()} / {(batch.initialQuantity ?? 0).toLocaleString()}
            </span>
          </div>
          <SimpleDistributionBar distribution={distribution} />
          {/* Show reserved quantity if any (potting plans) */}
          {!isGhostBatch && distribution.allocatedPotting > 0 && (
            <div className="flex justify-between text-xs text-amber-600 mt-1">
              <span>Reserved for plans</span>
              <span>
                {distribution.allocatedPotting.toLocaleString()} ·
                <span className="text-muted-foreground ml-1">
                  {distribution.available.toLocaleString()} available
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {/* For ghost batches, show a combined badge with status; for real batches show phase + status */}
          {isGhostBatch ? (
            <>
              <Badge 
                variant={isIncoming ? "secondary" : "outline"} 
                className={cn(
                  "font-medium",
                  isPlanned && "border-amber-400 text-amber-700 dark:text-amber-400",
                  isIncoming && "border-blue-400 text-blue-700 dark:text-blue-400"
                )}
              >
                {isIncoming ? "📦 Incoming" : "📋 Planned"}
              </Badge>
              {/* Show target size/info if available */}
              {batch.size && (
                <Badge variant="outline" className="text-muted-foreground">
                  Target: {typeof batch.size === 'string' ? batch.size : (batch.size as { name?: string })?.name ?? String(batch.size)}
                </Badge>
              )}
            </>
          ) : (
            <>
              {phase && (
                <Badge variant="secondary" className="capitalize">{phase}</Badge>
              )}
              {batch.status && (
                <Badge variant={getStatusVariant(batch.status)}>
                  {batch.status}
                </Badge>
              )}
            </>
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
