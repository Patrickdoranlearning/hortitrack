'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ScanLine,
  Check,
  X,
  Package,
  Camera,
  Repeat,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScanStep, type ScannedBatch } from './ScanStep';
import { StatusPhotoStep, type StatusPhotoData } from './StatusPhotoStep';

export type ProductionStatusOption = {
  id: string;
  systemCode: string;
  displayLabel: string;
  behavior: string | null;
  color: string | null;
};

export type WizardState = {
  batch: ScannedBatch | null;
  statusPhotoData: StatusPhotoData | null;
};

type CompletedBatch = {
  id: string;
  batchNumber: string;
  status: string;
  saleableQuantity: number | null;
  hasPhoto: boolean;
};

const STEPS = [
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'status', label: 'Status & Photo', icon: Camera },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type SaleabilityWizardProps = {
  statusOptions: ProductionStatusOption[];
  onComplete?: () => void;
};

export function SaleabilityWizard({ statusOptions, onComplete }: SaleabilityWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepId>('scan');
  const [wizardState, setWizardState] = useState<WizardState>({
    batch: null,
    statusPhotoData: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Continuous mode state
  const [continuousMode, setContinuousMode] = useState(true);
  const [completedBatches, setCompletedBatches] = useState<CompletedBatch[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Handlers
  const handleBatchSelected = useCallback((batch: ScannedBatch) => {
    setWizardState((prev) => ({ ...prev, batch }));
    setCurrentStep('status');
  }, []);

  const handleStatusPhotoComplete = useCallback(
    async (data: StatusPhotoData) => {
      if (!wizardState.batch) return;

      setIsSaving(true);

      try {
        // Update status
        const statusResponse = await fetch('/api/batches/bulk-status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            batchIds: [wizardState.batch.id],
            statusId: data.statusId,
            status: data.statusCode,
          }),
        });

        if (!statusResponse.ok) {
          const errData = await statusResponse.json();
          const errMsg = typeof errData?.error === 'string'
            ? errData.error
            : errData?.error?.message || 'Failed to update status';
          throw new Error(errMsg);
        }

        // Update saleable quantity if provided
        if (data.saleableQuantity !== null && data.saleableQuantity !== undefined) {
          const qtyResponse = await fetch(`/api/batches/${wizardState.batch.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              saleable_quantity: data.saleableQuantity,
            }),
          });

          if (!qtyResponse.ok) {
            const errData = await qtyResponse.json();
            const errMsg = typeof errData?.error === 'string'
              ? errData.error
              : errData?.error?.message || 'Failed to update saleable quantity';
            throw new Error(errMsg);
          }
        }

        // Upload photo if provided
        if (data.photoFile) {
          const formData = new FormData();
          formData.append('file', data.photoFile);
          formData.append('batchId', wizardState.batch.id);

          const photoResponse = await fetch('/api/batches/upload-photo', {
            method: 'POST',
            body: formData,
          });

          if (!photoResponse.ok) {
            const errData = await photoResponse.json();
            const errMsg = typeof errData?.error === 'string'
              ? errData.error
              : errData?.error?.message || 'Failed to upload photo';
            throw new Error(errMsg);
          }
        }

        // Track completed batch
        const completed: CompletedBatch = {
          id: wizardState.batch.id,
          batchNumber: wizardState.batch.batchNumber,
          status: data.statusLabel,
          saleableQuantity: data.saleableQuantity,
          hasPhoto: !!data.photoFile,
        };
        setCompletedBatches((prev) => [...prev, completed]);

        setWizardState((prev) => ({ ...prev, statusPhotoData: data }));
        toast.success('Batch updated', {
          description: `${wizardState.batch.batchNumber} marked as ${data.statusLabel}`,
        });

        // In continuous mode, go back to scan step; otherwise complete
        if (continuousMode) {
          // Reset for next batch but keep continuous mode on
          setCurrentStep('scan');
          setWizardState({ batch: null, statusPhotoData: null });
        } else {
          onComplete?.();
          resetWizard();
        }
      } catch (error: any) {
        console.error('Failed to update batch', error);
        toast.error('Update failed', { description: error.message });
      } finally {
        setIsSaving(false);
      }
    },
    [wizardState.batch, onComplete, continuousMode]
  );

  const goBack = useCallback(() => {
    if (currentStep === 'status') {
      setCurrentStep('scan');
    }
  }, [currentStep]);

  const resetWizard = useCallback(() => {
    setCurrentStep('scan');
    setWizardState({
      batch: null,
      statusPhotoData: null,
    });
    setCompletedBatches([]);
    setShowSummary(false);
  }, []);

  const finishSession = useCallback(() => {
    if (completedBatches.length > 0) {
      setShowSummary(true);
    } else {
      onComplete?.();
    }
  }, [completedBatches.length, onComplete]);

  const closeSession = useCallback(() => {
    setShowSummary(false);
    setCompletedBatches([]);
    onComplete?.();
  }, [onComplete]);

  // Show session summary if requested
  if (showSummary) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Session Complete</h2>
          <p className="text-muted-foreground">
            You updated {completedBatches.length} batch{completedBatches.length !== 1 ? 'es' : ''} in this session.
          </p>
        </div>

        {/* Completed batches list */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {completedBatches.map((batch, idx) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                    <div>
                      <p className="font-medium text-sm">#{batch.batchNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch.status}
                        {batch.saleableQuantity != null && ` · ${batch.saleableQuantity} saleable`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {batch.hasPhoto && (
                      <Badge variant="secondary" className="text-xs">
                        <Camera className="h-3 w-3 mr-1" />
                        Photo
                      </Badge>
                    )}
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setShowSummary(false)}>
            <Repeat className="h-4 w-4 mr-2" />
            Continue Scanning
          </Button>
          <Button className="flex-1" onClick={closeSession}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Continuous Mode Toggle & Session Counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            id="continuous-mode"
            checked={continuousMode}
            onCheckedChange={setContinuousMode}
          />
          <Label htmlFor="continuous-mode" className="text-sm cursor-pointer">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Continuous mode
            </div>
          </Label>
        </div>
        {completedBatches.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {completedBatches.length} updated
            </Badge>
            <Button variant="ghost" size="sm" onClick={finishSession}>
              Finish
            </Button>
          </div>
        )}
      </div>

      {/* Step Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2 flex-1',
                  index > 0 && 'justify-center',
                  index === STEPS.length - 1 && 'justify-end'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && 'bg-primary/20 text-primary',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>
        <Progress value={progressPercent} className="h-1" />
      </div>

      {/* Batch Summary (shown when past step 1) */}
      {wizardState.batch && currentStep !== 'scan' && (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">#{wizardState.batch.batchNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {wizardState.batch.variety ?? 'Unknown variety'}
                    {wizardState.batch.size && ` · ${wizardState.batch.size}`}
                    {wizardState.batch.quantity != null && ` · ${wizardState.batch.quantity} units`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={resetWizard}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 'scan' && <ScanStep onBatchSelected={handleBatchSelected} />}

        {currentStep === 'status' && wizardState.batch && (
          <StatusPhotoStep
            batch={wizardState.batch}
            statusOptions={statusOptions}
            onComplete={handleStatusPhotoComplete}
            onBack={goBack}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
