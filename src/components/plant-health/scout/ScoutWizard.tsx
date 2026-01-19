'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ScanLine,
  ClipboardList,
  Syringe,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScanStep } from './ScanStep';
import { ScoutLogStep, type LogData } from './ScoutLogStep';
import { TreatmentStep, type TreatmentData } from './TreatmentStep';
import { createScoutLog, scheduleTreatment } from '@/app/actions/plant-health';

export type Batch = {
  id: string;
  batchNumber: string;
  variety?: string;
  quantity?: number;
  family?: string;
};

export type ScannedTarget = {
  type: 'location' | 'batch';
  location?: {
    id: string;
    name: string;
    type?: string;
    batches: Batch[];
  };
  batch?: Batch;
};

export type WizardState = {
  target: ScannedTarget | null;
  logData: LogData | null;
  treatmentData: TreatmentData | null;
};

const STEPS = [
  { id: 'scan', label: 'Scan', icon: ScanLine },
  { id: 'log', label: 'Log', icon: ClipboardList },
  { id: 'treatment', label: 'Treatment', icon: Syringe },
] as const;

type StepId = typeof STEPS[number]['id'];

// Determine if treatment step is needed based on log data
function needsTreatment(logData: LogData | null): boolean {
  if (!logData) return false;

  // Issue with medium or critical severity
  if (logData.logType === 'issue' && logData.issue) {
    if (logData.issue.severity === 'medium' || logData.issue.severity === 'critical') {
      return true;
    }
  }

  // EC reading below threshold (needs feeding)
  if (logData.logType === 'reading' && logData.reading) {
    if (logData.reading.ec !== undefined && logData.reading.ec < 0.5) {
      return true;
    }
    // pH outside optimal range
    if (logData.reading.ph !== undefined) {
      if (logData.reading.ph < 5.5 || logData.reading.ph > 6.5) {
        return true;
      }
    }

    // EC reading outside optimal range
    if (logData.reading.ec !== undefined) {
      if (logData.reading.ec < 0.5 || logData.reading.ec > 3.0) {
        return true;
      }
    }
  }

  return false;
}

// Determine suggested treatment type based on log data
function getSuggestedTreatmentType(logData: LogData | null): 'chemical' | 'mechanical' | 'feeding' | null {
  if (!logData) return null;

  // Low EC suggests feeding
  if (logData.logType === 'reading' && logData.reading?.ec !== undefined && logData.reading.ec < 0.5) {
    return 'feeding';
  }

  // Issues typically need chemical treatment
  if (logData.logType === 'issue') {
    return 'chemical';
  }

  return null;
}

type ScoutWizardProps = {
  onComplete?: () => void;
};

export function ScoutWizard({ onComplete }: ScoutWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepId>('scan');
  const [wizardState, setWizardState] = useState<WizardState>({
    target: null,
    logData: null,
    treatmentData: null,
  });
  const [savedLogId, setSavedLogId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  // Handlers
  const handleTargetSelected = useCallback((target: ScannedTarget) => {
    setWizardState((prev) => ({ ...prev, target }));
    setCurrentStep('log');
  }, []);

  const handleLogComplete = useCallback(async (logData: LogData) => {
    setIsSaving(true);

    try {
      // Save the scout log to the database
      const result = await createScoutLog({
        locationId: logData.locationId,
        logType: logData.logType,
        issueReason: logData.issue?.reason,
        severity: logData.issue?.severity,
        ec: logData.reading?.ec,
        ph: logData.reading?.ph,
        notes: logData.logType === 'issue' ? logData.issue?.notes : logData.reading?.notes,
        photoUrl: logData.photoPreview, // TODO: Upload photo and get URL
        affectedBatchIds: logData.selectedBatchIds,
      });

      if (!result.success) {
        toast.error('Failed to save', { description: result.error });
        setIsSaving(false);
        return;
      }

      setSavedLogId(result.data?.logId || null);
      setWizardState((prev) => ({ ...prev, logData }));

      if (needsTreatment(logData)) {
        setCurrentStep('treatment');
      } else {
        // Skip treatment step - complete
        toast.success('Scout complete', {
          description: 'Log saved. No immediate treatment required.',
        });
        onComplete?.();
        resetWizard();
      }
    } catch (error) {
      console.error('Failed to save scout log', error);
      toast.error('Failed to save scout log');
    } finally {
      setIsSaving(false);
    }
  }, [onComplete]);

  const handleTreatmentComplete = useCallback(async (treatmentData: TreatmentData | null) => {
    if (!treatmentData) {
      toast.success('Scout complete', { description: 'Log saved without treatment' });
      onComplete?.();
      resetWizard();
      return;
    }

    setIsSaving(true);
    try {
      const targetLocation = wizardState.target?.location;

      if (!targetLocation) {
        toast.error('No location selected - cannot schedule treatment for batch-only scans');
        setIsSaving(false);
        return;
      }

      const result = await scheduleTreatment({
        locationId: targetLocation.id,
        treatmentType: treatmentData.type,
        productId: treatmentData.productId,
        productName: treatmentData.productName,
        rate: treatmentData.rate,
        rateUnit: treatmentData.rateUnit,
        method: treatmentData.method,
        applicationsTotal: treatmentData.applicationsTotal,
        applicationIntervalDays: treatmentData.applicationIntervalDays,
        mechanicalAction: treatmentData.mechanicalAction,
        fertilizerName: treatmentData.fertilizerName,
        fertilizerRate: treatmentData.fertilizerRate,
        fertilizerUnit: treatmentData.fertilizerUnit,
        scheduledDate: treatmentData.scheduledDate,
        notes: treatmentData.notes,
        triggeredByLogId: savedLogId || undefined,
      });

      if (!result.success) {
        toast.error('Failed to schedule treatment', { description: result.error });
        setIsSaving(false);
        return;
      }

      setWizardState((prev) => ({ ...prev, treatmentData }));
      toast.success('Scout complete', { description: 'Treatment scheduled' });
      onComplete?.();
      resetWizard();
    } catch (error) {
      console.error('Failed to schedule treatment', error);
      toast.error('Failed to schedule treatment');
    } finally {
      setIsSaving(false);
    }
  }, [wizardState.target, savedLogId, onComplete]);

  const handleSkipTreatment = useCallback(() => {
    handleTreatmentComplete(null);
  }, [handleTreatmentComplete]);

  const goBack = useCallback(() => {
    if (currentStep === 'log') {
      setCurrentStep('scan');
    } else if (currentStep === 'treatment') {
      setCurrentStep('log');
    }
  }, [currentStep]);

  const resetWizard = useCallback(() => {
    setCurrentStep('scan');
    setWizardState({
      target: null,
      logData: null,
      treatmentData: null,
    });
    setSavedLogId(null);
  }, []);

  // Determine effective location and batches for logging
  // Priority: explicit location > batch's parent location
  const effectiveLocation = wizardState.target?.location || null;
  const effectiveBatch = wizardState.target?.batch || null;

  // Get the location ID for logging - must be a valid location
  const locationForLogging = effectiveLocation?.id || null;
  const locationNameForDisplay = effectiveLocation?.name || effectiveBatch?.batchNumber || 'Unknown';
  const batchesForLogging = effectiveLocation?.batches || (effectiveBatch ? [effectiveBatch] : []);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const Icon = step.icon;

            // Don't show treatment step indicator if not needed
            if (step.id === 'treatment' && !needsTreatment(wizardState.logData) && currentStep !== 'treatment') {
              return null;
            }

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

      {/* Target Summary (shown when past step 1) */}
      {wizardState.target && currentStep !== 'scan' && (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {wizardState.target.type === 'location' ? (
                    <MapPin className="h-5 w-5 text-primary" />
                  ) : (
                    <Package className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {locationNameForDisplay}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {wizardState.target.type === 'location'
                      ? `${batchesForLogging.length} batches`
                      : `Batch ${effectiveBatch?.variety || ''}`}
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
        {currentStep === 'scan' && (
          <ScanStep onTargetSelected={handleTargetSelected} />
        )}

        {currentStep === 'log' && (effectiveLocation || effectiveBatch) && (
          <ScoutLogStep
            locationId={locationForLogging || ''}
            locationName={locationNameForDisplay}
            batches={batchesForLogging}
            onComplete={handleLogComplete}
            onBack={goBack}
          />
        )}

        {currentStep === 'treatment' && effectiveLocation && wizardState.logData && (
          <TreatmentStep
            locationId={effectiveLocation.id}
            locationName={locationNameForDisplay}
            batches={batchesForLogging}
            logData={wizardState.logData}
            suggestedType={getSuggestedTreatmentType(wizardState.logData)}
            onComplete={handleTreatmentComplete}
            onSkip={handleSkipTreatment}
            onBack={goBack}
          />
        )}
      </div>
    </div>
  );
}

