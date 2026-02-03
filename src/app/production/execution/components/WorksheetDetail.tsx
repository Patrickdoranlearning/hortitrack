"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Printer,
  Trash2,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/http/fetchJson";
import { cn } from "@/lib/utils";
import { PrintWorksheetFromSaved } from "./PrintWorksheet";
import type { ExecutionWorksheetWithBatches, WorksheetBatch } from "@/server/production/execution-worksheets";

type Props = {
  worksheet: ExecutionWorksheetWithBatches;
  onDeleted: () => void;
  onRefresh: () => void;
};

export function WorksheetDetail({ worksheet, onDeleted, onRefresh }: Props) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await fetchJson(`/api/production/execution-worksheets/${worksheet.id}`, {
        method: "DELETE",
      });
      toast({
        title: "Worksheet deleted",
        description: `"${worksheet.name}" has been deleted.`,
      });
      onDeleted();
    } catch (error) {
      toast({
        title: "Failed to delete worksheet",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleStatusChange = async (action: "complete" | "reopen") => {
    setIsUpdatingStatus(true);
    try {
      await fetchJson(`/api/production/execution-worksheets/${worksheet.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast({
        title: action === "complete" ? "Worksheet completed" : "Worksheet reopened",
        description:
          action === "complete"
            ? `"${worksheet.name}" marked as complete.`
            : `"${worksheet.name}" has been reopened.`,
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Failed to update worksheet",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
  };

  const handlePrintClose = () => {
    setIsPrinting(false);
  };

  // Sort batches: incomplete first, then by sort order
  const sortedBatches = React.useMemo(() => {
    return [...worksheet.batches].sort((a, b) => {
      // Completed batches go to the bottom
      if (a.completedAt && !b.completedAt) return 1;
      if (!a.completedAt && b.completedAt) return -1;
      // Otherwise sort by sort order
      return a.sortOrder - b.sortOrder;
    });
  }, [worksheet.batches]);

  return (
    <>
      <div className="space-y-3">
        {/* Description if present */}
        {worksheet.description && (
          <p className="text-sm text-muted-foreground">{worksheet.description}</p>
        )}

        {/* Batch list */}
        <div className="space-y-1">
          {sortedBatches.map((wb) => (
            <BatchRow key={wb.batchId} worksheetBatch={wb} />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {worksheet.status === "open" ? (
                  <DropdownMenuItem
                    onClick={() => handleStatusChange("complete")}
                    disabled={isUpdatingStatus}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Mark Complete
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => handleStatusChange("reopen")}
                    disabled={isUpdatingStatus}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reopen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Worksheet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-xs text-muted-foreground">
            Created {format(new Date(worksheet.createdAt), "MMM d, h:mm a")}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete worksheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{worksheet.name}&rdquo; and its tracking data.
              The batches themselves will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print component */}
      {isPrinting && (
        <PrintWorksheetFromSaved
          worksheet={worksheet}
          onClose={handlePrintClose}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Batch Row
// ---------------------------------------------------------------------------

type BatchRowProps = {
  worksheetBatch: WorksheetBatch;
};

function BatchRow({ worksheetBatch }: BatchRowProps) {
  const batch = worksheetBatch.batch;
  const isCompleted = worksheetBatch.completedAt !== null;

  // Ghost statuses are the ones that need execution
  const isGhostStatus = batch?.status === "Incoming" || batch?.status === "Planned";

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded text-sm",
        isCompleted && "bg-muted/50"
      )}
    >
      {/* Completion indicator */}
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      )}

      {/* Batch info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", isCompleted && "line-through text-muted-foreground")}>
            {batch?.plantVarietyName ?? "Unknown"}
          </span>
          {batch?.batchCode && (
            <span className="text-xs text-muted-foreground">#{batch.batchCode}</span>
          )}
        </div>
      </div>

      {/* Size & quantity */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
        {batch?.sizeName && <span>{batch.sizeName}</span>}
        <span>{batch?.quantity?.toLocaleString() ?? "-"}</span>
      </div>

      {/* Status badge */}
      <Badge
        variant={isGhostStatus ? "outline" : "secondary"}
        className={cn(
          "text-xs shrink-0",
          isCompleted && "opacity-50"
        )}
      >
        {batch?.status ?? "Unknown"}
      </Badge>

      {/* Link to batch (if we have ID) */}
      {batch?.id && (
        <a
          href={`/production/batches/${batch.id}`}
          className="text-muted-foreground hover:text-foreground"
          title="View batch details"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      {/* Completion timestamp */}
      {isCompleted && worksheetBatch.completedAt && (
        <span className="hidden md:block text-xs text-muted-foreground">
          {format(new Date(worksheetBatch.completedAt), "MMM d")}
        </span>
      )}
    </div>
  );
}
