'use client';

import { useState, useCallback, useContext } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Package,
  MapPin,
  ClipboardCheck,
  Check,
  Loader2,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { Button } from '@/components/ui/button';
import { SelectPlannedBatchesStep, type SelectPlannedBatchesStepData, type PlannedBatch } from './SelectPlannedBatchesStep';
import { ActualizeByLocationStep, type ActualizeByLocationStepData, type ActualizedBatchEntry } from './ActualizeByLocationStep';
import { ActualizeReviewStep, type ActualizeReviewStepData } from './ActualizeReviewStep';

export type ActualizeWizardState = {
  selection: SelectPlannedBatchesStepData | null;
  actualization: ActualizeByLocationStepData | null;
  review: ActualizeReviewStepData | null;
};

const STEPS = [
  { id: 'select', label: 'Select Batches', icon: Package },
  { id: 'actualize', label: 'Actualize', icon: Play },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

type StepId = 'select' | 'actualize' | 'review';

type ActualizeWizardProps = {
  // Optional: pre-select batches (e.g., from a job)
  initialBatches?: PlannedBatch[];
  jobId?: string;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
};

export function ActualizeWizard({
  initialBatches,
  jobId,
  onComplete,
  onCancel,
}: ActualizeWizardProps) {
  const { data: refData, loading: refLoading } = useContext(ReferenceDataContext);

  const [currentStep, setCurrentStep] = useState<StepId>(initialBatches?.length ? 'actualize' : 'select');
  const [wizardState, setWizardState] = useState<ActualizeWizardState>({
    selection: initialBatches?.length
      ? { selectedBatches: initialBatches }
      : null,
    actualization: null,
    review: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Get current steps
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Step completion checks
  const isStepComplete = useCallback(
    (stepId: StepId): boolean => {
      switch (stepId) {
        case 'select':
          return !!wizardState.selection && Array.isArray(wizardState.selection.selectedBatches) && wizardState.selection.selectedBatches.length > 0;
        case 'actualize':
          return !!wizardState.actualization && Array.isArray(wizardState.actualization.entries) && wizardState.actualization.entries.length > 0;
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
      setCurrentStep(STEPS[idx - 1].id as StepId);
    }
  }, [currentStepIndex]);

  const goNext = useCallback(() => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id as StepId);
    }
  }, [currentStepIndex]);

  // Step handlers
  const handleSelectionComplete = useCallback(
    (data: SelectPlannedBatchesStepData) => {
      setWizardState((prev) => ({ ...prev, selection: data }));
      goNext();
    },
    [goNext]
  );

  const handleActualizationComplete = useCallback(
    (data: ActualizeByLocationStepData) => {
      setWizardState((prev) => ({ ...prev, actualization: data }));
      goNext();
    },
    [goNext]
  );

  const handleReviewComplete = useCallback(
    async (data: ActualizeReviewStepData) => {
      setWizardState((prev) => ({ ...prev, review: data }));
      await handleSubmit({
        ...wizardState,
        review: data,
      });
    },
    [wizardState]
  );

  // Final submission
  const handleSubmit = useCallback(
    async (finalState: ActualizeWizardState) => {
      if (!finalState.actualization) {
        toast.error('Please actualize batches first');
        return;
      }

      setIsSaving(true);

      try {
        const payload = {
          batches: finalState.actualization.entries.map((entry) => ({
            batch_id: entry.batchId,
            actual_quantity: entry.actualQuantity,
            actual_location_id: entry.actualLocationId || undefined,
            actual_date: entry.actualDate,
            notes: entry.notes || undefined,
            size_id: entry.sizeId || undefined, // For material consumption
          })),
          job_id: jobId || undefined,
          notes: finalState.review?.globalNotes || undefined,
          consume_materials: true, // Enable material consumption
        };

        console.log('[ActualizeWizard] Submitting payload:', JSON.stringify(payload, null, 2));

        const response = await fetch('/api/production/batches/actualize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let errData: any = {};
          try {
            const text = await response.text();
            console.error('[ActualizeWizard] API error response text:', text);
            errData = text ? JSON.parse(text) : {};
          } catch (parseErr) {
            console.error('[ActualizeWizard] Failed to parse error response:', parseErr);
          }
          console.error('[ActualizeWizard] API error:', errData, 'status:', response.status);
          let errorMessage = errData.error ?? `Failed to actualize batches (${response.status})`;
          if (errData.errors?.length) {
            errorMessage += ': ' + errData.errors.join('; ');
          }
          if (errData.issues?.length) {
            errorMessage += ': ' + errData.issues.map((i: any) => i.message).join('; ');
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        toast.success('Batches actualized successfully', {
          description: `${result.actualized} batch${result.actualized !== 1 ? 'es' : ''} now active`,
        });
        onComplete?.(result);
      } catch (error: any) {
        console.error('Actualization failed:', error);
        toast.error('Actualization failed', { description: error.message });
      } finally {
        setIsSaving(false);
      }
    },
    [jobId, onComplete]
  );

  // Loading state
  if (refLoading && !refData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!refData && currentStep !== 'select') {
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
            const isCompleted = index < currentStepIndex || isStepComplete(step.id as StepId);
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => {
                  if (index <= currentStepIndex || isStepComplete(STEPS[index - 1]?.id as StepId)) {
                    goToStep(step.id as StepId);
                  }
                }}
                disabled={index > currentStepIndex && !isStepComplete(STEPS[index - 1]?.id as StepId)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && !isActive && 'bg-primary/20 text-primary cursor-pointer',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                  index > currentStepIndex &&
                  !isStepComplete(STEPS[index - 1]?.id as StepId) &&
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
        {currentStep === 'select' && (
          <SelectPlannedBatchesStep
            initialData={wizardState.selection}
            onComplete={handleSelectionComplete}
            onCancel={onCancel}
          />
        )}

        {currentStep === 'actualize' && refData && wizardState.selection && (
          <ActualizeByLocationStep
            referenceData={refData}
            selectedBatches={wizardState.selection.selectedBatches}
            initialData={wizardState.actualization}
            onComplete={handleActualizationComplete}
            onBack={initialBatches?.length ? undefined : goBack}
          />
        )}

        {currentStep === 'review' && wizardState.actualization && (
          <ActualizeReviewStep
            entries={wizardState.actualization.entries}
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
