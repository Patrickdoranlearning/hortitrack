'use client';

import { useState, useCallback, useContext } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Truck, Package, ClipboardCheck, Check, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { Button } from '@/components/ui/button';
import { SupplierExpectedDateStep, type SupplierExpectedDateData } from './SupplierExpectedDateStep';
import { PlanBatchesStep, type PlanBatchesStepData, type PlannedBatchEntry } from './PlanBatchesStep';
import { ReviewStep, type ReviewStepData } from './ReviewStep';

export type PlanIncomingWizardState = {
  supplierExpectedDate: SupplierExpectedDateData | null;
  batches: PlanBatchesStepData | null;
  review: ReviewStepData | null;
};

const STEPS = [
  { id: 'supplier', label: 'Supplier & Date', icon: Truck },
  { id: 'batches', label: 'Add Batches', icon: Package },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type PlanIncomingWizardProps = {
  onComplete?: (result: any) => void;
  onCancel?: () => void;
};

export function PlanIncomingWizard({ onComplete, onCancel }: PlanIncomingWizardProps) {
  const { data: refData, loading: refLoading } = useContext(ReferenceDataContext);

  const [currentStep, setCurrentStep] = useState<StepId>('supplier');
  const [wizardState, setWizardState] = useState<PlanIncomingWizardState>({
    supplierExpectedDate: null,
    batches: null,
    review: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Step completion checks
  const isStepComplete = useCallback(
    (stepId: StepId): boolean => {
      switch (stepId) {
        case 'supplier':
          return wizardState.supplierExpectedDate !== null;
        case 'batches':
          return wizardState.batches !== null && wizardState.batches.batches.length > 0;
        case 'review':
          return false; // Review step leads to submit
        default:
          return false;
      }
    },
    [wizardState]
  );

  // Navigation handlers
  const goToStep = useCallback((stepId: StepId) => {
    setCurrentStep(stepId);
  }, []);

  const goBack = useCallback(() => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].id);
    }
  }, [currentStepIndex]);

  const goNext = useCallback(() => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id);
    }
  }, [currentStepIndex]);

  // Step handlers
  const handleSupplierComplete = useCallback(
    (data: SupplierExpectedDateData) => {
      setWizardState((prev) => ({ ...prev, supplierExpectedDate: data }));
      goNext();
    },
    [goNext]
  );

  // Handler for order upload extraction (auto-populates both steps)
  const handleExtractionConfirmed = useCallback(
    (supplierData: SupplierExpectedDateData, batches: PlannedBatchEntry[]) => {
      setWizardState((prev) => ({
        ...prev,
        supplierExpectedDate: supplierData,
        batches: { batches },
      }));
      // Navigate to batches step so user can review/edit the pre-populated data
      setCurrentStep('batches');
    },
    []
  );

  const handleBatchesComplete = useCallback(
    (data: PlanBatchesStepData) => {
      setWizardState((prev) => ({ ...prev, batches: data }));
      goNext();
    },
    [goNext]
  );

  const handleReviewComplete = useCallback(
    async (data: ReviewStepData) => {
      setWizardState((prev) => ({ ...prev, review: data }));

      // Now submit everything
      await handleSubmit({
        ...wizardState,
        review: data,
      });
    },
    [wizardState]
  );

  // Final submission
  const handleSubmit = useCallback(
    async (finalState: PlanIncomingWizardState) => {
      if (!finalState.supplierExpectedDate || !finalState.batches) {
        toast.error('Please complete all steps');
        return;
      }

      setIsSaving(true);

      try {
        // Build payload for plan-incoming API
        const payload = {
          supplier_id: finalState.supplierExpectedDate.supplierId,
          expected_date: finalState.supplierExpectedDate.expectedDate,
          supplier_reference: finalState.supplierExpectedDate.supplierReference || undefined,
          notes: finalState.review?.globalNotes || undefined,
          batches: finalState.batches.batches.map((batch) => ({
            plant_variety_id: batch.varietyId,
            size_id: batch.sizeId,
            location_id: batch.locationId || undefined,
            expected_quantity: batch.expectedQuantity,
            notes: batch.notes || undefined,
          })),
        };

        const response = await fetch('/api/production/batches/plan-incoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errData = await response.json();
          let errorMessage = errData.error ?? 'Failed to plan incoming batches';
          if (errData.errors && Array.isArray(errData.errors) && errData.errors.length > 0) {
            errorMessage += ': ' + errData.errors.join('; ');
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();

        toast.success('Batches planned successfully', {
          description: `${result.created} batch${result.created !== 1 ? 'es' : ''} created with "Incoming" status`,
        });

        onComplete?.(result);
      } catch (error: any) {
        toast.error('Planning failed', { description: error.message });
      } finally {
        setIsSaving(false);
      }
    },
    [onComplete]
  );

  // Loading state
  if (refLoading && !refData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!refData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load reference data. Please try again.</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex || isStepComplete(step.id);
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => {
                  // Only allow going back or to completed steps
                  if (index <= currentStepIndex || isStepComplete(STEPS[index - 1]?.id)) {
                    goToStep(step.id);
                  }
                }}
                disabled={index > currentStepIndex && !isStepComplete(STEPS[index - 1]?.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && !isActive && 'bg-primary/20 text-primary cursor-pointer',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                  index > currentStepIndex &&
                    !isStepComplete(STEPS[index - 1]?.id) &&
                    'cursor-not-allowed opacity-50'
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="text-sm font-medium hidden md:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>

      {/* Step Content */}
      <div className="min-h-[450px]">
        {currentStep === 'supplier' && (
          <SupplierExpectedDateStep
            referenceData={refData}
            initialData={wizardState.supplierExpectedDate}
            onComplete={handleSupplierComplete}
            onExtractionConfirmed={handleExtractionConfirmed}
            onCancel={onCancel}
          />
        )}

        {currentStep === 'batches' && wizardState.supplierExpectedDate && (
          <PlanBatchesStep
            referenceData={refData}
            supplierData={wizardState.supplierExpectedDate}
            initialData={wizardState.batches}
            onComplete={handleBatchesComplete}
            onBack={goBack}
          />
        )}

        {currentStep === 'review' && wizardState.supplierExpectedDate && wizardState.batches && (
          <ReviewStep
            supplierData={wizardState.supplierExpectedDate}
            batchesData={wizardState.batches}
            initialData={wizardState.review}
            onComplete={handleReviewComplete}
            onBack={goBack}
            isSubmitting={isSaving}
          />
        )}
      </div>
    </div>
  );
}
