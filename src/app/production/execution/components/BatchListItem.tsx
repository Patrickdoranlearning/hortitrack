"use client";

import * as React from "react";
import Link from "next/link";
import { format, getWeek } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PlanningBatch } from "@/lib/planning/types";

type Props = {
  batch: PlanningBatch;
  index: number;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
};

const statusColors: Record<string, string> = {
  Incoming: "bg-green-100 text-green-800 border-green-200",
  Planned: "bg-purple-100 text-purple-800 border-purple-200",
  "Plugs/Liners": "bg-amber-100 text-amber-800 border-amber-200",
};

export function BatchListItem({ batch, index, selectable = false, selected = false, onSelectChange }: Props) {
  const formattedDate = batch.readyDate
    ? format(new Date(batch.readyDate), "dd MMM")
    : "TBC";

  const weekNumber = batch.readyDate
    ? `W${getWeek(new Date(batch.readyDate))}`
    : null;

  return (
    <tr className={cn("hover:bg-muted/30 transition-colors", selected && "bg-primary/5")}>
      {selectable && (
        <td className="px-3 py-2 w-8">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectChange?.(checked === true)}
            aria-label={`Select batch ${batch.batchNumber || batch.varietyName}`}
          />
        </td>
      )}
      <td className="px-3 py-2 text-muted-foreground">{index}</td>
      <td className="px-3 py-2">
        <div>
          <Link
            href={`/production/batches/${batch.id}`}
            className="font-medium hover:underline"
          >
            {batch.varietyName ?? "Unknown variety"}
          </Link>
          {batch.batchNumber && (
            <span className="ml-2 text-xs text-muted-foreground">
              #{batch.batchNumber}
            </span>
          )}
        </div>
        {batch.parentBatchNumber && (
          <div className="text-xs text-muted-foreground">
            Source: #{batch.parentBatchNumber}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {batch.sizeName ?? "-"}
      </td>
      <td className="px-3 py-2 text-right font-medium">
        {batch.quantity.toLocaleString()}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span>{formattedDate}</span>
          {weekNumber && (
            <Badge variant="outline" className="text-xs">
              {weekNumber}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {batch.supplierName ?? "-"}
      </td>
      <td className="px-3 py-2">
        <Badge
          variant="outline"
          className={cn("text-xs", statusColors[batch.status] ?? "")}
        >
          {batch.status}
        </Badge>
      </td>
    </tr>
  );
}
