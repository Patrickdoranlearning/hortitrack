"use client";

import { AncestryNode } from "@/types/batch";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  nodes: AncestryNode[] | null;             // null → loading skeleton
  currentBatchNumber: string;
  onOpenBatch: (toBatchNumber: string, index: number) => void;
  loadingToId?: string | null;
  stayOnAncestry: boolean;
  onToggleStayOnAncestry?: (v: boolean) => void;
};

export function AncestryTab({
  nodes,
  currentBatchNumber,
  onOpenBatch,
  loadingToId,
  stayOnAncestry,
  onToggleStayOnAncestry,
}: Props) {
  if (nodes === null) {
    return <SkeletonRow />;
  }

  if (!nodes.length) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium tracking-tight">Lineage</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={stayOnAncestry}
            onChange={(e) => onToggleStayOnAncestry?.(e.target.checked)}
          />
          Stay on Ancestry when navigating
        </label>
      </div>

      <TooltipProvider>
        <div className="flex items-stretch gap-2 overflow-x-auto py-1">
          {nodes.map((node, idx) => {
            const isCurrent = node.batchNumber === currentBatchNumber && idx === 0;
            const disabled = !!node.locked || node.batchNumber === currentBatchNumber;
            const tooltip = node.locked
              ? "You don’t have permission to open this batch."
              : isCurrent ? "Currently viewing this batch." : `Open batch ${node.batchNumber}`;

            return (
              <div key={node.batchNumber} className="flex items-center">
                {idx > 0 && (
                  <ChevronRight aria-hidden className="shrink-0" />
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative w-[220px] rounded-2xl border bg-card text-card-foreground shadow-sm px-4 py-3 text-left transition-transform duration-150",
                        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/60",
                        disabled ? "opacity-70 cursor-not-allowed border-dashed" : "hover:scale-[0.99] active:scale-[0.98]",
                        isCurrent ? "border-[#6AB04A]" : "border-muted"
                      )}
                      disabled={disabled}
                      aria-disabled={disabled}
                      aria-label={tooltip}
                      onClick={() => onOpenBatch(node.batchNumber, idx)}
                      onKeyDown={(e) => {
                        if (disabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenBatch(node.batchNumber, idx);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-serif text-lg leading-none">{node.batchNumber}</div>
                        {node.locked ? (
                          <Lock className="h-4 w-4 mt-1" aria-hidden />
                        ) : loadingToId === node.batchNumber ? (
                          <Loader2 className="h-4 w-4 animate-spin mt-1" aria-hidden />
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm line-clamp-1">{node.variety ?? "—"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {[node.family, node.supplierName].filter(Boolean).join(" • ") || " "}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[node.size, node.productionWeek].filter(Boolean).join(" • ") || " "}
                      </div>

                      {/* Status badge */}
                      {node.status && (
                        <span className={cn(
                          "absolute bottom-2 right-3 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                          node.status.toLowerCase().includes("archiv") ? "bg-muted text-foreground/70 border border-dashed" : "bg-muted text-foreground"
                        )}>
                          {node.status}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{tooltip}</TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-muted-foreground">
      No ancestry found for this batch.
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-[220px] h-[90px] rounded-2xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}
