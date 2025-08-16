
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
  onQr?: () => void;
  onPrint?: () => void;
  onActionLog?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  className?: string;
};

export function BatchActionBar({
  batch,
  onEdit,
  onMove,
  onQr,
  onPrint,
  onActionLog,
  onArchive,
  onUnarchive,
  onDelete,
  className,
}: Props) {
  const isArchived = Boolean(batch.archived) || String(batch.status).toLowerCase() === "archived";

  return (
    <TooltipProvider>
      <div
        className={[
          "w-full grid grid-flow-col grid-rows-2 auto-cols-fr gap-2",
          "rounded-xl bg-muted/30 p-2",
          className ?? "",
        ].join(" ")}
        data-testid="batch-action-bar"
      >
        <Button onClick={onEdit} disabled={!onEdit} className="rounded-2xl w-full" data-testid="btn-edit">
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button onClick={onMove} variant="secondary" disabled={!onMove} className="rounded-2xl w-full" data-testid="btn-transplant">
          <MoveRight className="mr-2 h-4 w-4" /> Transplant
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onQr} variant="outline" size="sm" disabled={!onQr} className="rounded-2xl w-full" data-testid="btn-qr">
              <QrCode className="mr-2 h-4 w-4" /> QR
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate / show QR</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onPrint} variant="outline" size="sm" disabled={!onPrint} className="rounded-2xl w-full" data-testid="btn-print">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </TooltipTrigger>
          <TooltipContent>Print label</TooltipContent>
        </Tooltip>
        <Button
          onClick={onActionLog}
          disabled={!onActionLog}
          className="rounded-2xl w-full"
          data-testid="btn-action-log"
        >
          <History className="mr-2 h-4 w-4" /> Action Log
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="rounded-2xl w-full" aria-label="More actions" data-testid="btn-more">
              <MoreHorizontal className="mr-2 h-4 w-4" /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>More actions</DropdownMenuLabel>
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
    </TooltipProvider>
  );
}
