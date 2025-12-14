"use client";

import { CheckInWizardDialog, type IncomingBatchData } from "@/components/production/checkin";

type BatchCheckInDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incomingBatch?: IncomingBatchData | null;
  onSuccess?: (batch: any) => void;
};

export function BatchCheckInDialog({
  open,
  onOpenChange,
  incomingBatch,
  onSuccess
}: BatchCheckInDialogProps) {
  return (
    <CheckInWizardDialog
      open={open}
      onOpenChange={onOpenChange}
      incomingBatch={incomingBatch}
      onSuccess={onSuccess}
    />
  );
}
