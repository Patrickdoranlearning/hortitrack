
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Pencil, MoveRight, QrCode, Printer, MoreHorizontal,
  Archive as ArchiveIcon, ArchiveRestore, Trash2, History,
} from "lucide-react";
import * as React from "react";
import BatchPhotoUploader from "@/components/batches/BatchPhotoUploader";
import Link from "next/link";
import { ActionDialog } from "@/components/actions/ActionDialog";
import type { ActionMode } from "@/components/actions/types";
import { TransplantIcon } from "../icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BatchLite = {
  id: string;
  batchNumber: string | number;
  status?: string;
  archived?: boolean;
};

type Props = {
  batch: BatchLite;
  onEdit?: () => void;
  onMove?: () => void;
  onPrint?: () => void;
  onActionLog?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  onPhotoAdded?: (p: { id: string; url: string }) => void;
  className?: string;
};

export function BatchActionBar({
  batch,
  onEdit,
  onMove,
  onPrint,
  onActionLog,
  onArchive,
  onUnarchive,
  onDelete,
  onPhotoAdded,
  className,
}: Props) {
  const isArchived = Boolean(batch.archived) || String(batch.status).toLowerCase() === "archived";
  const [actionOpen, setActionOpen] = React.useState(false);
  const [locations, setLocations] = React.useState<{id: string; name: string}[]>([]);
  const [actionMode] = React.useState<ActionMode>("MOVE");
  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/locations", { headers: { "Accept": "application/json" } });
        const json = await res.json();
        // Defensive mapping to ensure `items` array is used
        const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
        if (!canceled) setLocations(items);
      } catch {
        if (!canceled) setLocations([]);
      }
    })();
    return () => { canceled = true; };
  }, []);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "w-full grid grid-cols-2 md:grid-cols-none md:grid-flow-col md:auto-cols-max md:justify-start gap-2",
          "rounded-xl bg-muted/30 p-2",
          className
        )}
        data-testid="batch-action-bar"
      >
        <Button onClick={onMove} disabled={!onMove} className="rounded-2xl w-full" data-testid="btn-transplant">
          <TransplantIcon /> Transplant
        </Button>
        <Button onClick={() => setActionOpen(true)} className="rounded-2xl w-full" data-testid="btn-actions">
          <MoreHorizontal className="mr-2 h-4 w-4" /> Actions
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onPrint} variant="outline" disabled={!onPrint} className="rounded-2xl w-full" data-testid="btn-print">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </TooltipTrigger>
          <TooltipContent>Print label</TooltipContent>
        </Tooltip>
        {batch?.id && typeof batch.id === "string" && !String(batch.id).includes("/") ? (
           <Link
              href={`/batches/${encodeURIComponent(String(batch.id))}/history`}
              className={cn(buttonVariants({ variant: 'outline' }), 'rounded-2xl w-full')}
              data-testid="btn-history"
            >
            <History className="mr-2 h-4 w-4" />
            History
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-2xl w-full border opacity-60 cursor-not-allowed px-3 py-2 text-sm"
            title="Save the batch before viewing history"
          >
            <History className="mr-2 h-4 w-4" />
            History
          </button>
        )}
        {!!batch.id && (
          <BatchPhotoUploader batchId={String(batch.id)} onUploaded={onPhotoAdded} />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-2xl w-full" aria-label="More actions" data-testid="btn-more">
              <MoreHorizontal className="mr-2 h-4 w-4" /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>More actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={onEdit} disabled={!onEdit} data-testid="mi-edit">
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            {isArchived ? (
              <DropdownMenuItem onClick={onUnarchive} disabled={!onUnarchive} data-testid="mi-unarchive">
                <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onArchive} disabled={!onArchive} data-testid="mi-archive">
                <ArchiveIcon className="mr-2 h-4 w-4" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={!onDelete}
              className="text-red-600 focus:text-red-600"
              data-testid="mi-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
       <ActionDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
       batch={batch}
        locations={locations}
        mode={actionMode}
      />
    </TooltipProvider>
  );
}
