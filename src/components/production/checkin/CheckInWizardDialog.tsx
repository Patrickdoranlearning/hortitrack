'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CheckInWizard, type IncomingBatchData } from './CheckInWizard';

type CheckInWizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incomingBatch?: IncomingBatchData | null;
  onSuccess?: (batch: any) => void;
};

export function CheckInWizardDialog({
  open,
  onOpenChange,
  incomingBatch,
  onSuccess,
}: CheckInWizardDialogProps) {
  const handleComplete = (batch: any) => {
    onSuccess?.(batch);
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
            {incomingBatch ? 'Check-in Incoming Batch' : 'Check-in New Batch'}
          </DialogTitle>
          <DialogDescription>
            {incomingBatch
              ? 'Confirm the arrival details and record quality information.'
              : 'Enter variety, size, quantity, supplier, location, quality, and optional plant passport overrides.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <CheckInWizard
            incomingBatch={incomingBatch}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
