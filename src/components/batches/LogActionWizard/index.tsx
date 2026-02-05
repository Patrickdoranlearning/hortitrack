'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type OperationalActionType,
  ACTION_META,
} from '@/types/batch-actions';
import { ActionTypeStep } from './ActionTypeStep';
import { PruningForm } from './forms/PruningForm';
import { WeedingForm } from './forms/WeedingForm';
import { SpacingForm } from './forms/SpacingForm';
import { MoveForm } from './forms/MoveForm';
import { DumpForm } from './forms/DumpForm';
import { QuickScoutForm } from './forms/QuickScoutForm';
import { QuickSaleableForm } from './forms/QuickSaleableForm';

// ============================================================================
// Types
// ============================================================================

export type BatchInfo = {
  id: string;
  batchNumber: string;
  variety?: string;
  unitsCurrent?: number;
  quantity?: number;
  saleableQuantity?: number;
};

type LogActionWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: BatchInfo;
  onSuccess?: () => void;
};

type WizardStep = 'select' | 'form' | 'confirm';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'select', label: 'Select Action' },
  { id: 'form', label: 'Details' },
  { id: 'confirm', label: 'Done' },
];

// ============================================================================
// Wizard Component
// ============================================================================

export function LogActionWizard({
  open,
  onOpenChange,
  batch,
  onSuccess,
}: LogActionWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<WizardStep>('select');
  const [selectedAction, setSelectedAction] = React.useState<OperationalActionType | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Calculate progress
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Reset wizard state when dialog closes
  React.useEffect(() => {
    if (!open) {
      // Small delay to let animation complete
      const timer = setTimeout(() => {
        setCurrentStep('select');
        setSelectedAction(null);
        setIsSubmitting(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handlers
  const handleActionSelect = React.useCallback((action: OperationalActionType) => {
    setSelectedAction(action);
    setCurrentStep('form');
  }, []);

  const handleFormComplete = React.useCallback(async () => {
    setCurrentStep('confirm');
    // Show success state briefly then close
    setTimeout(() => {
      toast.success('Action logged', {
        description: `${selectedAction ? ACTION_META[selectedAction].label : 'Action'} recorded for batch ${batch.batchNumber}`,
      });
      onSuccess?.();
      onOpenChange(false);
    }, 1000);
  }, [batch.batchNumber, onOpenChange, onSuccess, selectedAction]);

  const handleBack = React.useCallback(() => {
    if (currentStep === 'form') {
      setCurrentStep('select');
      setSelectedAction(null);
    }
  }, [currentStep]);

  // Render the appropriate form based on selected action
  const renderForm = () => {
    if (!selectedAction) return null;

    const currentQuantity = batch.quantity ?? batch.unitsCurrent ?? 0;
    const commonProps = {
      batchId: batch.id,
      onComplete: handleFormComplete,
      onCancel: handleBack,
      setIsSubmitting,
    };

    switch (selectedAction) {
      case 'pruning':
        return <PruningForm {...commonProps} />;
      case 'weeding':
        return <WeedingForm {...commonProps} />;
      case 'spacing':
        return <SpacingForm {...commonProps} currentQuantity={currentQuantity} />;
      case 'move':
        return <MoveForm {...commonProps} currentQuantity={currentQuantity} />;
      case 'dump':
        return <DumpForm {...commonProps} currentQuantity={currentQuantity} />;
      case 'scout':
        return <QuickScoutForm {...commonProps} />;
      case 'saleable':
        return (
          <QuickSaleableForm
            {...commonProps}
            currentQuantity={currentQuantity}
            currentSaleableQuantity={batch.saleableQuantity}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto z-[1010]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'select' && 'Log Action'}
            {currentStep === 'form' && selectedAction && ACTION_META[selectedAction].label}
            {currentStep === 'confirm' && 'Done'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'select' && `Record an action for batch ${batch.batchNumber}`}
            {currentStep === 'form' && `${batch.variety || batch.batchNumber}`}
            {currentStep === 'confirm' && 'Action recorded successfully'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-1',
                    isActive && 'text-primary font-medium',
                    isCompleted && 'text-primary'
                  )}
                >
                  {isCompleted && <Check className="h-3 w-3" />}
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Step Content */}
        <div className="min-h-[200px] py-4">
          {currentStep === 'select' && (
            <ActionTypeStep onSelect={handleActionSelect} />
          )}

          {currentStep === 'form' && (
            <div className="space-y-4">
              {/* Back button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={isSubmitting}
                className="mb-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {renderForm()}
            </div>
          )}

          {currentStep === 'confirm' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-center text-muted-foreground">
                {selectedAction && ACTION_META[selectedAction].label} recorded
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LogActionWizard;
