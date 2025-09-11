"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AncestryNode } from "@/types/ancestry";

interface MiniBatchCardProps {
  node: AncestryNode;
  isCurrent?: boolean;
  onOpen: (batchId: string) => void;
}

export function MiniBatchCard({ node, isCurrent, onOpen }: MiniBatchCardProps) {
  const disabled = isCurrent;
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && onOpen(node.id)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") onOpen(node.id);
      }}
      className={cn(
        "relative w-[220px] shrink-0 cursor-pointer select-none rounded-2xl p-3 shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2",
        isCurrent ? "ring-2 border-[--accent] ring-[--accent]" : "border-muted",
        disabled && "opacity-95 cursor-default"
      )}
      aria-label={`Open batch ${node.batchNumber}`}
    >
      <div className="absolute right-2 top-2">
        <Badge variant={node.status === "Active" ? "default" : "secondary"}>{node.status}</Badge>
      </div>

      <div className="text-sm font-semibold leading-tight">
        <span className="font-serif">{node.batchNumber}</span>
        {node.size ? (
          <span className="ml-2 font-normal text-muted-foreground">{node.size}</span>
        ) : null}
      </div>

      <div className="truncate text-sm italic">{node.variety}</div>

      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {node.family && <span>{node.family}</span>}
        {node.supplierName && <span>• {node.supplierName}</span>}
        {node.productionWeek && <span>• {node.productionWeek}</span>}
      </div>

      {!isCurrent && node.status !== "Active" && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-dashed opacity-70" />
      )}
    </Card>
  );
}
