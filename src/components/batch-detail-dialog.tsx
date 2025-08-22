"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getBatchAncestry, getBatchSummary } from "@/lib/api/batches";
import { AncestryNode } from "@/types/batch";
import { AncestryTab } from "@/components/batch/AncestryTab";
import { useToast } from "@/components/ui/use-toast";
import { ChevronLeft } from "lucide-react";
import { track } from "@/lib/analytics";
import { logError, logInfo } from "@/lib/log";
import { useAncestryNavPreference } from "@/lib/prefs";
import type { Batch } from '@/lib/types';
import { useBatchDetailDialog } from "@/stores/useBatchDetailDialog";
import { BatchDetail } from "@/components/batch/BatchDetail";

export function BatchDetailDialog() {
  const { isOpen, batchId, initialTab, close, back, history } = useBatchDetailDialog();
  const [activeBatch, setActiveBatch] = React.useState(batchId);

  React.useEffect(() => {
    if (isOpen) {
      setActiveBatch(batchId);
    }
  }, [isOpen, batchId]);

  if (!isOpen || !activeBatch) return null;

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <Button variant="ghost" size="icon" onClick={back} className="-ml-2">
                <ChevronLeft />
                <span className="sr-only">Back to previous batch</span>
              </Button>
            )}
            <DialogTitle>{`Batch ${activeBatch}`}</DialogTitle>
          </div>
          <DialogDescription>
            View Summary, Log History, Photos, Ancestry, and AI Tools.
          </DialogDescription>
        </DialogHeader>
        <BatchDetail key={activeBatch} batchId={activeBatch} initialTab={initialTab} />
      </DialogContent>
    </Dialog>
  );
}

// Kept for compatibility, can be removed once all references are updated.
export function BatchSummaryDialog() {
    return <BatchDetailDialog />
}
