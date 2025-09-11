// src/components/batch/BatchActionsBar.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoveRight, ScanLine, Scissors, ClipboardList, Pencil, Archive } from "lucide-react";

type Props = {
  batchId: string;
  batchNumber?: string;
  disabled?: boolean;
};

/**
 * Compact, scrollable action bar for mobile. Place inside DialogHeader.
 * Adjust routes/handlers to your app URLs if they differ.
 */
export default function BatchActionsBar({ batchId, batchNumber, disabled }: Props) {
  const q = `?batchId=${encodeURIComponent(batchId)}`;
  return (
    <div
      className="sticky top-0 z-10 -mx-6 px-6 py-2 bg-background/80 border-b
                 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <Link href={`/production/check-in${q}`}><Button size="sm" disabled={disabled} className="shrink-0"><ScanLine className="h-4 w-4 mr-1"/>Check-in</Button></Link>
        <Link href={`/production/transplant${q}`}><Button size="sm" disabled={disabled} className="shrink-0"><Scissors className="h-4 w-4 mr-1"/>Transplant</Button></Link>
        <Link href={`/production/move${q}`}><Button size="sm" disabled={disabled} className="shrink-0"><MoveRight className="h-4 w-4 mr-1"/>Move</Button></Link>
        <Link href={`/production/actions${q}`}><Button size="sm" disabled={disabled} className="shrink-0"><ClipboardList className="h-4 w-4 mr-1"/>Action</Button></Link>
        <Link href={`/production/batches/${encodeURIComponent(batchId)}/edit`}><Button size="sm" variant="secondary" disabled={disabled} className="shrink-0"><Pencil className="h-4 w-4 mr-1"/>Edit</Button></Link>
        <Link href={`/production/batches/${encodeURIComponent(batchId)}/archive`}><Button size="sm" variant="outline" disabled={disabled} className="shrink-0"><Archive className="h-4 w-4 mr-1"/>Archive</Button></Link>
      </div>
      {batchNumber ? (
        <div className="mt-1 text-[11px] text-muted-foreground">Batch: {batchNumber}</div>
      ) : null}
    </div>
  );
}
