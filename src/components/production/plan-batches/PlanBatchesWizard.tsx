'use client';

import { useState, useCallback, useContext } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Sprout,
  ArrowRightLeft,
  Package,
  ClipboardCheck,
  Check,
  Loader2,
  LayoutList,
  Boxes,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { Button } from '@/components/ui/button';
import { PlanTypeStep, type PlanType } from './PlanTypeStep';
import { PlanPropagationStep, type PlanPropagationStepData } from './PlanPropagationStep';
import {
  SelectSourceBatchesStep,
  type SelectSourceBatchesStepData,
  type SourceBatch,
} from './SelectSourceBatchesStep';
import { ConfigureTransplantsStep, type ConfigureTransplantsStepData } from './ConfigureTransplantsStep';
import { ConfigureMaterialsStep, type ConfigureMaterialsStepData } from './ConfigureMaterialsStep';
import { ReviewStep, type ReviewStepData } from './ReviewStep';

export type PlanBatchesWizardState = {
  planType: PlanType | null;
  propagation: PlanPropagationStepData | null;
  sourceSelection: SelectSourceBatchesStepData | null;
  transplantConfig: ConfigureTransplantsStepData | null;
  materials: ConfigureMaterialsStepData | null;
  review: ReviewStepData | null;
};

// Dynamic steps based on plan type
const PROPAGATION_STEPS = [
  { id: 'type', label: 'Plan Type', icon: LayoutList },
  { id: 'propagation', label: 'Add Batches', icon: Sprout },
  { id: 'materials', label: 'Materials', icon: Boxes },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

const TRANSPLANT_STEPS = [
  { id: 'type', label: 'Plan Type', icon: LayoutList },
  { id: 'select', label: 'Select Batches', icon: Package },
  { id: 'configure', label: 'Configure', icon: ArrowRightLeft },
  { id: 'materials', label: 'Materials', icon: Boxes },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

type StepId = 'type' | 'propagation' | 'select' | 'configure' | 'materials' | 'review';

type PlanBatchesWizardProps = {
  onComplete?: (result: any) => void;
  onCancel?: () => void;
};

export function PlanBatchesWizard({ onComplete, onCancel }: PlanBatchesWizardProps) {
  const { data: refData, loading: refLoading } = useContext(ReferenceDataContext);

  const [currentStep, setCurrentStep] = useState<StepId>('type');
  const [wizardState, setWizardState] = useState<PlanBatchesWizardState>({
    planType: null,
    propagation: null,
    sourceSelection: null,
    transplantConfig: null,
    materials: null,
    review: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Get current steps based on plan type
  const steps = wizardState.planType === 'transplant' ? TRANSPLANT_STEPS : PROPAGATION_STEPS;
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  // Step completion checks
  const isStepComplete = useCallback(
    (stepId: StepId): boolean => {
      switch (stepId) {
        case 'type':
          return wizardState.planType !== null;
        case 'propagation':
          return wizardState.propagation !== null && wizardState.propagation.batches.length > 0;
        case 'select':
          return wizardState.sourceSelection !== null && wizardState.sourceSelection.selectedBatches.length > 0;
        case 'configure':
          return wizardState.transplantConfig !== null && wizardState.transplantConfig.transplants.length > 0;
        case 'materials':
          // Materials step is optional - it's complete if visited (even if skipped)
          return wizardState.materials !== null;
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
      setCurrentStep(steps[idx - 1].id as StepId);
    }
  }, [currentStepIndex, steps]);

  const goNext = useCallback(() => {
    const idx = currentStepIndex;
    if (idx < steps.length - 1) {
      setCurrentStep(steps[idx + 1].id as StepId);
    }
  }, [currentStepIndex, steps]);

  // Step handlers
  const handleTypeSelect = useCallback((type: PlanType) => {
    setWizardState((prev) => ({
      ...prev,
      planType: type,
      // Reset data when switching types
      propagation: null,
      sourceSelection: null,
      transplantConfig: null,
      materials: null,
      review: null,
    }));
    // Navigate to next step based on type
    if (type === 'propagation') {
      setCurrentStep('propagation');
    } else {
      setCurrentStep('select');
    }
  }, []);

  const handlePropagationComplete = useCallback(
    (data: PlanPropagationStepData) => {
      setWizardState((prev) => ({ ...prev, propagation: data }));
      goNext();
    },
    [goNext]
  );

  const handleSourceSelectionComplete = useCallback(
    (data: SelectSourceBatchesStepData) => {
      setWizardState((prev) => ({ ...prev, sourceSelection: data }));
      goNext();
    },
    [goNext]
  );

  const handleTransplantConfigComplete = useCallback(
    (data: ConfigureTransplantsStepData) => {
      setWizardState((prev) => ({ ...prev, transplantConfig: data }));
      goNext();
    },
    [goNext]
  );

  const handleMaterialsComplete = useCallback(
    (data: ConfigureMaterialsStepData) => {
      setWizardState((prev) => ({ ...prev, materials: data }));
      goNext();
    },
    [goNext]
  );

  const handleReviewComplete = useCallback(
    async (data: ReviewStepData) => {
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
    async (finalState: PlanBatchesWizardState) => {
      if (!finalState.planType) {
        toast.error('Please select a plan type');
        return;
      }

      setIsSaving(true);

      try {
        if (finalState.planType === 'propagation') {
          // Submit propagation plan
          if (!finalState.propagation) {
            toast.error('Please add propagation batches');
            return;
          }

          // Build materials array grouped by batch temp ID
          const materialsByBatch: Record<string, Array<{ material_id: string; quantity: number; notes?: string }>> = {};
          if (finalState.materials && !finalState.materials.skipMaterials) {
            finalState.materials.materials.forEach((mat) => {
              if (!materialsByBatch[mat.batchTempId]) {
                materialsByBatch[mat.batchTempId] = [];
              }
              materialsByBatch[mat.batchTempId].push({
                material_id: mat.materialId,
                quantity: mat.quantity,
                notes: mat.notes || undefined,
              });
            });
          }

          const payload = {
            planned_date: finalState.propagation.plannedDate,
            notes: finalState.review?.globalNotes || undefined,
            batches: finalState.propagation.batches.map((batch) => ({
              plant_variety_id: batch.varietyId,
              size_id: batch.sizeId,
              location_id: batch.locationId || undefined,
              expected_quantity: batch.expectedQuantity,
              notes: batch.notes || undefined,
              materials: materialsByBatch[batch.id] || [],
            })),
            create_job: finalState.review?.createJob ?? false,
            job_name: finalState.review?.jobName || undefined,
          };

          const response = await fetch('/api/production/batches/plan-propagation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            let errData: any = {};
            try {
              const text = await response.text();
              errData = text ? JSON.parse(text) : {};
            } catch {
              // Failed to parse error response
            }
            let errorMessage = errData.error ?? `Failed to plan propagation batches (${response.status})`;
            if (errData.issues?.length) {
              errorMessage += ': ' + errData.issues.map((i: any) => i.message).join('; ');
            }
            throw new Error(errorMessage);
          }

          const result = await response.json();
          toast.success('Propagation planned successfully', {
            description: `${result.created} batch${result.created !== 1 ? 'es' : ''} created with "Planned" status`,
          });
          onComplete?.(result);
        } else {
          // Submit transplant plan
          if (!finalState.sourceSelection || !finalState.transplantConfig) {
            toast.error('Please configure transplants');
            return;
          }

          // Build materials array grouped by batch temp ID for transplants
          const transplantMaterialsByBatch: Record<string, Array<{ material_id: string; quantity: number; notes?: string }>> = {};
          if (finalState.materials && !finalState.materials.skipMaterials) {
            finalState.materials.materials.forEach((mat) => {
              if (!transplantMaterialsByBatch[mat.batchTempId]) {
                transplantMaterialsByBatch[mat.batchTempId] = [];
              }
              transplantMaterialsByBatch[mat.batchTempId].push({
                material_id: mat.materialId,
                quantity: mat.quantity,
                notes: mat.notes || undefined,
              });
            });
          }

          const payload = {
            planned_week: finalState.sourceSelection.plannedWeek,
            notes: finalState.review?.globalNotes || undefined,
            transplants: finalState.transplantConfig.transplants.map((t) => ({
              source_batch_id: t.sourceBatchId,
              target_size_id: t.targetSizeId,
              location_id: t.locationId || undefined,
              quantity: t.quantity,
              notes: t.notes || undefined,
              materials: transplantMaterialsByBatch[t.id] || [],
            })),
            create_job: finalState.review?.createJob ?? false,
            job_name: finalState.review?.jobName || undefined,
          };

          const response = await fetch('/api/production/batches/plan-transplant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            let errData: any = {};
            try {
              const text = await response.text();
              errData = text ? JSON.parse(text) : {};
            } catch {
              // Failed to parse error response
            }
            let errorMessage = errData.error ?? `Failed to plan transplants (${response.status})`;
            if (errData.errors?.length) {
              errorMessage += ': ' + errData.errors.join('; ');
            }
            if (errData.issues?.length) {
              errorMessage += ': ' + errData.issues.map((i: any) => i.message).join('; ');
            }
            throw new Error(errorMessage);
          }

          const result = await response.json();
          toast.success('Transplants planned successfully', {
            description: `${result.created} batch${result.created !== 1 ? 'es' : ''} created with "Planned" status`,
          });
          onComplete?.(result);
        }
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

  if (!refData && currentStep !== 'type' && currentStep !== 'select') {
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
      {/* Step Indicator - only show after type selection */}
      {wizardState.planType && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex || isStepComplete(step.id as StepId);
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (index <= currentStepIndex || isStepComplete(steps[index - 1]?.id as StepId)) {
                      goToStep(step.id as StepId);
                    }
                  }}
                  disabled={index > currentStepIndex && !isStepComplete(steps[index - 1]?.id as StepId)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && !isActive && 'bg-primary/20 text-primary cursor-pointer',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                    index > currentStepIndex &&
                      !isStepComplete(steps[index - 1]?.id as StepId) &&
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
      )}

      {/* Step Content */}
      <div className="min-h-[450px]">
        {currentStep === 'type' && (
          <PlanTypeStep
            selectedType={wizardState.planType}
            onSelect={handleTypeSelect}
            onCancel={onCancel}
          />
        )}

        {currentStep === 'propagation' && refData && (
          <PlanPropagationStep
            referenceData={refData}
            initialData={wizardState.propagation}
            onComplete={handlePropagationComplete}
            onBack={() => goToStep('type')}
          />
        )}

        {currentStep === 'select' && (
          <SelectSourceBatchesStep
            initialData={wizardState.sourceSelection}
            onComplete={handleSourceSelectionComplete}
            onBack={() => goToStep('type')}
          />
        )}

        {currentStep === 'configure' && refData && wizardState.sourceSelection && (
          <ConfigureTransplantsStep
            referenceData={refData}
            selectedBatches={wizardState.sourceSelection.selectedBatches}
            initialData={wizardState.transplantConfig}
            onComplete={handleTransplantConfigComplete}
            onBack={goBack}
          />
        )}

        {currentStep === 'materials' && refData && (
          <ConfigureMaterialsStep
            referenceData={refData}
            propagationBatches={wizardState.propagation?.batches}
            transplantBatches={wizardState.transplantConfig?.transplants}
            initialData={wizardState.materials}
            onComplete={handleMaterialsComplete}
            onBack={goBack}
          />
        )}

        {currentStep === 'review' && wizardState.planType && (
          <ReviewStep
            planType={wizardState.planType}
            plannedDate={
              wizardState.planType === 'propagation'
                ? wizardState.propagation?.plannedDate ?? ''
                : ''
            }
            plannedWeek={
              wizardState.planType === 'transplant'
                ? wizardState.sourceSelection?.plannedWeek ?? ''
                : undefined
            }
            propagationData={wizardState.propagation ?? undefined}
            transplantData={wizardState.transplantConfig?.transplants}
            materialsData={wizardState.materials ?? undefined}
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
