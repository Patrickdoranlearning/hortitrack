"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BulkTransplantUpload from "@/components/batches/BulkTransplantUpload";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BulkTransplantDialog({ open, onOpenChange }: Props) {
  const handleComplete = React.useCallback(() => {
    // Keep dialog open so user can see results
    // They can close manually when done reviewing
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Transplant</DialogTitle>
          <DialogDescription>
            Create multiple transplant batches from existing parent batches at once. Upload a CSV or add rows manually.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          <BulkTransplantUpload onComplete={handleComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

