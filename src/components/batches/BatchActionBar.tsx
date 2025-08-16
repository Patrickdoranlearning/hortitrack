
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Pencil, MoveRight, QrCode, Printer, MoreHorizontal,
  Archive as ArchiveIcon, ArchiveRestore, Trash2,
} from "lucide-react";
import * as React from "react";

type BatchLite = {
  id: string;
  batchNumber: string | number;
  status?: string;         // e.g., "Active" | "Archived"
  archived?: boolean;      // optional flag some schemas use
};

type Props = {
  batch: BatchLite;
  onEdit?: () => void;
  onMove?: () => void;
  onQr?: () => void;
  onPrint?: () => void;
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
          "w-full flex flex-wrap items-center justify-between gap-2",
          "rounded-xl bg-muted/30 p-2",
          className ?? "",
        ].join(" ")}
        data-testid="batch-action-bar"
      >
        {/* Left: primary actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onEdit}
            disabled={!onEdit}
            className="rounded-2xl"
            data-testid="btn-edit"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            onClick={onMove}
            variant="secondary"
            disabled={!onMove}
            className="rounded-2xl"
            data-testid="btn-move"
          >
            <MoveRight className="mr-2 h-4 w-4" />
            Move
          </Button>
        </div>

        {/* Right: secondary + danger in kebab */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onQr}
                variant="outline"
                size="sm"
                disabled={!onQr}
                className="rounded-2xl"
                data-testid="btn-qr"
              >
                <QrCode className="mr-2 h-4 w-4" />
                QR
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate / show QR for this batch</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onPrint}
                variant="outline"
                size="sm"
                disabled={!onPrint}
                className="rounded-2xl"
                data-testid="btn-print"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </TooltipTrigger>
            <TooltipContent>Print label</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl"
                aria-label="More actions"
                data-testid="btn-more"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>More actions</DropdownMenuLabel>

              {isArchived ? (
                <DropdownMenuItem
                  onClick={onUnarchive}
                  disabled={!onUnarchive}
                  data-testid="mi-unarchive"
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={onArchive}
                  disabled={!onArchive}
                  data-testid="mi-archive"
                >
                  <ArchiveIcon className="mr-2 h-4 w-4" />
                  Archive
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
      </div>
    </TooltipProvider>
  );
}
