"use client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useBatchDetailDialog } from "@/stores/useBatchDetailDialog";
import { BatchDetail } from "./BatchDetail";
import BatchActionsBar from "@/components/batch/BatchActionsBar";

export function BatchDetailDialog() {
  const { isOpen, batchId, initialTab, close } = useBatchDetailDialog();
  if (!isOpen) return null;
  const hasBatch = Boolean(batchId);

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{hasBatch ? `Batch ${batchId}` : "Batch details"}</DialogTitle>
           {hasBatch && <BatchActionsBar batchId={batchId!} />}
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto pr-1">
        {hasBatch ? (
          <BatchDetail key={batchId} batchId={batchId!} initialTab={initialTab} />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Preparing batch details…</div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
