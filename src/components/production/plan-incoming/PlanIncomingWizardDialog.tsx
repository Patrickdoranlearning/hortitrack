'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { PlanIncomingWizard } from './PlanIncomingWizard';

type PlanIncomingWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: any) => void;
};

export function PlanIncomingWizardDialog({
  open,
  onOpenChange,
  onSuccess,
}: PlanIncomingWizardDialogProps) {
  const handleComplete = (result: any) => {
    onSuccess?.(result);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            Plan Incoming Batches
          </DialogTitle>
          <DialogDescription>
            Schedule expected deliveries from your suppliers. Batches will be created with "Incoming" status.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <ErrorBoundary>
            <PlanIncomingWizard
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          </ErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}
