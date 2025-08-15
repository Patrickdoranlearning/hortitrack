'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, MoveRight } from "lucide-react";
import type { Batch } from "@/lib/types";

export default function MobileBatchCard({
  batch,
  onView,
  onEdit,
  onDelete,
  onTransplant,
}: {
  batch: Batch;
  onView: (b: Batch) => void;
  onEdit: (b: Batch) => void;
  onDelete: (b: Batch) => void;
  onTransplant: (b: Batch) => void;
}) {
  return (
    <button
      onClick={() => onView(batch)}
      className="w-full text-left rounded-2xl border p-4 shadow-sm active:scale-[0.99] transition md:pointer-events-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Batch #{batch.batchNumber}</div>
          <div className="font-semibold text-base leading-tight">{batch.plantVariety}</div>
          <div className="text-xs text-muted-foreground">{batch.plantFamily}</div>
        </div>
        <Badge variant={
          batch.status === 'Ready for Sale' || batch.status === 'Looking Good'
            ? 'accent' : batch.status === 'Archived'
            ? 'destructive' : batch.status === 'Potted'
            ? 'default' : 'info'
        }>
          {batch.status}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted px-2 py-1">
          <div className="text-[11px] text-muted-foreground">Location</div>
          <div className="font-medium">{batch.location}</div>
        </div>
        <div className="rounded-lg bg-muted px-2 py-1">
          <div className="text-[11px] text-muted-foreground">Size</div>
          <div className="font-medium">{batch.size}</div>
        </div>
        <div className="rounded-lg bg-muted px-2 py-1">
          <div className="text-[11px] text-muted-foreground">Qty</div>
          <div className="font-medium">{batch.quantity?.toLocaleString?.() ?? batch.quantity}</div>
        </div>
        <div className="rounded-lg bg-muted px-2 py-1">
          <div className="text-[11px] text-muted-foreground">Initial</div>
          <div className="font-medium">{batch.initialQuantity?.toLocaleString?.() ?? batch.initialQuantity}</div>
        </div>
      </div>

      <div
        className="mt-3 flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] pb-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onTransplant(batch)}>
          <MoveRight className="mr-1 h-4 w-4" /> Transplant
        </Button>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onEdit(batch)}>
          <Pencil className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button size="sm" variant="destructive" className="shrink-0" onClick={() => onDelete(batch)}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
        <Button size="icon" variant="ghost" className="shrink-0" onClick={() => onView(batch)}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </button>
  );
}
