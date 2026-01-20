'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { PlanBatchesWizard } from './PlanBatchesWizard';

type PlanBatchesWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: any) => void;
};

export function PlanBatchesWizardDialog({
  open,
  onOpenChange,
  onSuccess,
}: PlanBatchesWizardDialogProps) {
  const handleComplete = (result: any) => {
    onSuccess?.(result);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            Plan Batches
          </DialogTitle>
          <DialogDescription>
            Schedule future propagation or transplant work. Batches will be created with "Planned" status.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <ErrorBoundary>
            <PlanBatchesWizard
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          </ErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}
