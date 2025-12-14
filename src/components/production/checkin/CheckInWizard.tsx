'use client';

import { useState, useCallback, useContext, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Truck,
  Package,
  ClipboardCheck,
  Camera,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';
import { Button } from '@/components/ui/button';
import { SupplierDeliveryStep, type SupplierDeliveryData } from './SupplierDeliveryStep';
import { BatchesStep, type BatchesStepData } from './BatchesStep';
import { QualityStep, type QualityStepData } from './QualityStep';
import { PhotosStep, type PhotosStepData } from './PhotosStep';

// Types for incoming batch data (from planning page)
export type IncomingBatchData = {
  id: string;
  batchNumber?: string;
  plantVarietyId: string;
  varietyName?: string;
  sizeId: string;
  sizeName?: string;
  supplierId?: string;
  supplierName?: string;
  expectedQuantity?: number;
  expectedContainers?: number;
  expectedDate?: string;
  locationId?: string;
  locationName?: string;
  phase?: string;
  reference?: string;
  notes?: string;
};

type IncomingBatchFromAPI = {
  id: string;
  batchNumber: string | null;
  varietyId: string | null;
  varietyName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  quantity: number;
  supplierId: string | null;
  supplierName: string | null;
  locationId: string | null;
  locationName: string | null;
};

export type WizardState = {
  supplierDelivery: SupplierDeliveryData | null;
  batches: BatchesStepData | null;
  quality: QualityStepData | null;
  photos: PhotosStepData | null;
};

const STEPS = [
  { id: 'supplier', label: 'Supplier & Delivery', icon: Truck },
  { id: 'batches', label: 'Batches', icon: Package },
  { id: 'quality', label: 'Quality', icon: ClipboardCheck },
  { id: 'photos', label: 'Photos', icon: Camera },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type CheckInWizardProps = {
  incomingBatch?: IncomingBatchData | null;
  onComplete?: (result: any) => void;
  onCancel?: () => void;
};

export function CheckInWizard({ incomingBatch, onComplete, onCancel }: CheckInWizardProps) {
  const { data: refData, loading: refLoading } = useContext(ReferenceDataContext);

  const [currentStep, setCurrentStep] = useState<StepId>('supplier');
  const [wizardState, setWizardState] = useState<WizardState>({
    supplierDelivery: null,
    batches: null,
    quality: null,
    photos: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [incomingBatches, setIncomingBatches] = useState<IncomingBatchFromAPI[]>([]);

  // Fetch incoming batches when supplier step is complete
  useEffect(() => {
    async function fetchIncoming() {
      if (!wizardState.supplierDelivery) return;

      try {
        const res = await fetch('/api/production/planning');
        if (res.ok) {
          const data = await res.json();
          // Filter to only Incoming status batches
          const incoming = (data.batches ?? [])
            .filter((b: any) => b.status === 'Incoming')
            .map((b: any) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              varietyId: b.varietyId,
              varietyName: b.varietyName,
              sizeId: b.sizeId,
              sizeName: b.sizeName,
              quantity: b.quantity,
              supplierId: b.supplierId,
              supplierName: b.supplierName,
              locationId: b.locationId,
              locationName: b.locationName,
            }));
          setIncomingBatches(incoming);
        }
      } catch (err) {
        console.error('Failed to fetch incoming batches:', err);
      }
    }
    fetchIncoming();
  }, [wizardState.supplierDelivery]);

  // Pre-fill from incoming batch if provided
  useEffect(() => {
    if (incomingBatch && refData) {
      const supplier = refData.suppliers?.find((s) => s.id === incomingBatch.supplierId);

      if (supplier) {
        setWizardState((prev) => ({
          ...prev,
          supplierDelivery: {
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierProducerCode: supplier.producer_code ?? null,
            supplierCountryCode: supplier.country_code ?? null,
            deliveryDate: incomingBatch.expectedDate ?? new Date().toISOString().slice(0, 10),
            supplierReference: incomingBatch.reference ?? '',
          },
        }));
      }
    }
  }, [incomingBatch, refData]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Step completion checks
  const isStepComplete = useCallback(
    (stepId: StepId): boolean => {
      switch (stepId) {
        case 'supplier':
          return wizardState.supplierDelivery !== null;
        case 'batches':
          return wizardState.batches !== null && wizardState.batches.batches.length > 0;
        case 'quality':
          return wizardState.quality !== null;
        case 'photos':
          return false; // Photos step leads to submit
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
  const handleSupplierComplete = useCallback((data: SupplierDeliveryData) => {
    setWizardState((prev) => ({ ...prev, supplierDelivery: data }));
    goNext();
  }, [goNext]);

  const handleBatchesComplete = useCallback((data: BatchesStepData) => {
    setWizardState((prev) => ({ ...prev, batches: data }));
    goNext();
  }, [goNext]);

  const handleQualityComplete = useCallback((data: QualityStepData) => {
    setWizardState((prev) => ({ ...prev, quality: data }));
    goNext();
  }, [goNext]);

  const handlePhotosComplete = useCallback(async (data: PhotosStepData) => {
    setWizardState((prev) => ({ ...prev, photos: data }));

    // Now submit everything
    await handleSubmit({
      ...wizardState,
      photos: data,
    });
  }, [wizardState]);

  // Final submission
  const handleSubmit = useCallback(async (finalState: WizardState) => {
    if (!finalState.supplierDelivery || !finalState.batches || !finalState.quality) {
      toast.error('Please complete all steps');
      return;
    }

    setIsSaving(true);

    try {
      // Build payload for multi-batch check-in
      const payload = {
        supplier_id: finalState.supplierDelivery.supplierId,
        delivery_date: finalState.supplierDelivery.deliveryDate,
        supplier_reference: finalState.supplierDelivery.supplierReference,
        overall_quality: finalState.quality.overallQuality,
        global_notes: finalState.quality.globalNotes,
        batches: finalState.batches.batches.map((batch) => {
          const quality = finalState.quality!.batchQualities.find(
            (q) => q.batchId === batch.id
          );
          return {
            incoming_batch_id: batch.incomingBatchId,
            plant_variety_id: batch.varietyId,
            size_id: batch.sizeId,
            location_id: batch.locationId,
            quantity: batch.quantity,
            quality_rating: quality?.qualityRating ?? finalState.quality!.overallQuality,
            pest_or_disease: quality?.hasPestOrDisease ?? false,
            notes: quality?.notes ?? '',
          };
        }),
        // Photo upload would be handled separately or as base64
        photo_count: finalState.photos?.photos.length ?? 0,
      };

      console.log('[CheckInWizard] Submitting payload:', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/production/batches/check-in-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error('[CheckInWizard] API error response:', errData);
        // Build detailed error message including individual batch errors
        let errorMessage = errData.error ?? 'Failed to check in batches';
        if (errData.errors && Array.isArray(errData.errors) && errData.errors.length > 0) {
          errorMessage += ': ' + errData.errors.join('; ');
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      toast.success('Check-in complete', {
        description: `${finalState.batches.batches.length} batch${finalState.batches.batches.length !== 1 ? 'es' : ''} checked in successfully`,
      });

      onComplete?.(result);
    } catch (error: any) {
      console.error('Check-in failed:', error);
      toast.error('Check-in failed', { description: error.message });
    } finally {
      setIsSaving(false);
    }
  }, [onComplete]);

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
                  index > currentStepIndex && !isStepComplete(STEPS[index - 1]?.id) && 'cursor-not-allowed opacity-50'
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
          <SupplierDeliveryStep
            referenceData={refData}
            initialData={wizardState.supplierDelivery}
            onComplete={handleSupplierComplete}
            onCancel={onCancel}
          />
        )}

        {currentStep === 'batches' && wizardState.supplierDelivery && (
          <BatchesStep
            referenceData={refData}
            supplierData={wizardState.supplierDelivery}
            incomingBatches={incomingBatches}
            initialData={wizardState.batches}
            onComplete={handleBatchesComplete}
            onBack={goBack}
          />
        )}

        {currentStep === 'quality' && wizardState.batches && (
          <QualityStep
            batches={wizardState.batches.batches}
            initialData={wizardState.quality}
            onComplete={handleQualityComplete}
            onBack={goBack}
          />
        )}

        {currentStep === 'photos' && wizardState.quality && (
          <PhotosStep
            initialData={wizardState.photos}
            onComplete={handlePhotosComplete}
            onBack={goBack}
            isSubmitting={isSaving}
          />
        )}
      </div>
    </div>
  );
}
