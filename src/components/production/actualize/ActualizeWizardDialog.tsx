'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ActualizeWizard } from './ActualizeWizard';
import type { PlannedBatch } from './SelectPlannedBatchesStep';

type ActualizeWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: any) => void;
  onComplete?: (result: any) => void;
  // Optional: pre-populate with batches (e.g., from a job)
  initialBatches?: PlannedBatch[];
  jobId?: string;
};

export function ActualizeWizardDialog({
  open,
  onOpenChange,
  onSuccess,
  onComplete,
  initialBatches,
  jobId,
}: ActualizeWizardDialogProps) {
  const handleComplete = (result: any) => {
    onOpenChange(false);
    onSuccess?.(result);
    onComplete?.(result);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Actualize Planned Batches</DialogTitle>
          <DialogDescription>
            Convert planned batches to active growing batches. Record actual quantities
            and locations.
          </DialogDescription>
        </DialogHeader>
        <ErrorBoundary>
          <ActualizeWizard
            initialBatches={initialBatches}
            jobId={jobId}
            onComplete={handleComplete}
            onCancel={() => onOpenChange(false)}
          />
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
