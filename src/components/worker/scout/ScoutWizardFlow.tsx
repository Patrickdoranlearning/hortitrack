"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ScanLine,
  ClipboardList,
  Syringe,
  Check,
  ChevronLeft,
  X,
  MapPin,
  Package,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { vibrateTap, vibrateSuccess, vibrateError } from "@/lib/haptics";
import { ScoutLogForm, type ScoutLogData } from "./ScoutLogForm";
import { TreatmentForm, type TreatmentFormData } from "./TreatmentForm";
import { createScoutLog, scheduleTreatment } from "@/app/actions/plant-health";

// Types
export type Batch = {
  id: string;
  batchNumber: string;
  variety?: string;
  quantity?: number;
  family?: string;
};

export type ScannedTarget = {
  type: "location" | "batch";
  location?: {
    id: string;
    name: string;
    type?: string;
    batches: Batch[];
  };
  batch?: Batch;
};

type WizardStep = "log" | "treatment" | "complete";

interface ScoutWizardFlowProps {
  target: ScannedTarget;
  onComplete?: () => void;
  onCancel?: () => void;
}

// Determine if treatment step is needed based on log data
function needsTreatment(logData: ScoutLogData | null): boolean {
  if (!logData) return false;

  // Issue with medium or critical severity
  if (logData.logType === "issue" && logData.issue) {
    if (logData.issue.severity === "medium" || logData.issue.severity === "critical") {
      return true;
    }
  }

  // EC reading below threshold (needs feeding)
  if (logData.logType === "reading" && logData.reading) {
    if (logData.reading.ec !== undefined && logData.reading.ec < 0.5) {
      return true;
    }
    // pH outside optimal range
    if (logData.reading.ph !== undefined) {
      if (logData.reading.ph < 5.5 || logData.reading.ph > 6.5) {
        return true;
      }
    }
  }

  return false;
}

// Determine suggested treatment type based on log data
function getSuggestedTreatmentType(logData: ScoutLogData | null): "chemical" | "mechanical" | "feeding" | null {
  if (!logData) return null;

  // Low EC suggests feeding
  if (logData.logType === "reading" && logData.reading?.ec !== undefined && logData.reading.ec < 0.5) {
    return "feeding";
  }

  // Issues typically need chemical treatment
  if (logData.logType === "issue") {
    return "chemical";
  }

  return null;
}

const STEPS = [
  { id: "log" as const, label: "Log", icon: ClipboardList },
  { id: "treatment" as const, label: "Treatment", icon: Syringe },
];

/**
 * Mobile-optimized scout wizard flow.
 * Guides workers through logging issues/readings and scheduling treatments.
 */
export function ScoutWizardFlow({
  target,
  onComplete,
  onCancel,
}: ScoutWizardFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("log");
  const [logData, setLogData] = useState<ScoutLogData | null>(null);
  const [savedLogId, setSavedLogId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get effective location and batches
  const effectiveLocation = target?.location || null;
  const effectiveBatch = target?.batch || null;
  const locationForLogging = effectiveLocation?.id || null;
  const locationNameForDisplay = effectiveLocation?.name || effectiveBatch?.batchNumber || "Unknown";
  const batchesForLogging = effectiveLocation?.batches || (effectiveBatch ? [effectiveBatch] : []);

  // Progress calculation
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const showTreatmentStep = needsTreatment(logData);
  const totalSteps = showTreatmentStep ? 2 : 1;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;

  // Handle log completion
  const handleLogComplete = useCallback(async (data: ScoutLogData) => {
    vibrateTap();
    setIsSaving(true);

    try {
      // Save the scout log to the database
      const result = await createScoutLog({
        locationId: locationForLogging || undefined,
        logType: data.logType,
        issueReason: data.issue?.reason,
        severity: data.issue?.severity,
        ec: data.reading?.ec,
        ph: data.reading?.ph,
        notes: data.logType === "issue" ? data.issue?.notes : data.reading?.notes,
        photoUrl: data.photoPreview, // TODO: Upload photo and get URL
        affectedBatchIds: data.selectedBatchIds,
      });

      if (!result.success) {
        vibrateError();
        toast.error("Failed to save", { description: result.error });
        setIsSaving(false);
        return;
      }

      setSavedLogId(result.data?.logId || null);
      setLogData(data);
      vibrateSuccess();

      if (needsTreatment(data)) {
        setCurrentStep("treatment");
      } else {
        // Skip treatment step - complete
        toast.success("Scout complete", {
          description: "Log saved. No immediate treatment required.",
        });
        handleComplete();
      }
    } catch (error) {
      vibrateError();
      console.error("Failed to save scout log", error);
      toast.error("Failed to save scout log");
    } finally {
      setIsSaving(false);
    }
  }, [locationForLogging]);

  // Handle treatment completion
  const handleTreatmentComplete = useCallback(async (data: TreatmentFormData | null) => {
    vibrateTap();

    if (!data) {
      vibrateSuccess();
      toast.success("Scout complete", { description: "Log saved without treatment" });
      handleComplete();
      return;
    }

    setIsSaving(true);
    try {
      if (!locationForLogging) {
        vibrateError();
        toast.error("No location selected - cannot schedule treatment for batch-only scans");
        setIsSaving(false);
        return;
      }

      const result = await scheduleTreatment({
        locationId: locationForLogging,
        treatmentType: data.type,
        productId: data.productId,
        productName: data.productName,
        rate: data.rate,
        rateUnit: data.rateUnit,
        method: data.method,
        applicationsTotal: data.applicationsTotal,
        applicationIntervalDays: data.applicationIntervalDays,
        mechanicalAction: data.mechanicalAction,
        fertilizerName: data.fertilizerName,
        fertilizerRate: data.fertilizerRate,
        fertilizerUnit: data.fertilizerUnit,
        scheduledDate: data.scheduledDate,
        notes: data.notes,
        triggeredByLogId: savedLogId || undefined,
      });

      if (!result.success) {
        vibrateError();
        toast.error("Failed to schedule treatment", { description: result.error });
        setIsSaving(false);
        return;
      }

      vibrateSuccess();
      toast.success("Scout complete", { description: "Treatment scheduled" });
      handleComplete();
    } catch (error) {
      vibrateError();
      console.error("Failed to schedule treatment", error);
      toast.error("Failed to schedule treatment");
    } finally {
      setIsSaving(false);
    }
  }, [locationForLogging, savedLogId]);

  const handleComplete = () => {
    onComplete?.();
    router.back();
  };

  const handleCancel = () => {
    vibrateTap();
    onCancel?.();
    router.back();
  };

  const goBack = () => {
    vibrateTap();
    if (currentStep === "treatment") {
      setCurrentStep("log");
    } else {
      handleCancel();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with progress */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] -ml-2"
            onClick={goBack}
            disabled={isSaving}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <h1 className="flex-1 text-center font-medium">Scout Wizard</h1>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            {STEPS.filter((s, i) => i === 0 || showTreatmentStep).map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = STEPS.findIndex((s) => s.id === currentStep) > index;
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2",
                    index === 0 && "flex-1",
                    index > 0 && "flex-1 justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && "bg-primary/20 text-primary",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>
      </div>

      {/* Target summary card */}
      <div className="px-4 pt-4">
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {target.type === "location" ? (
                  <MapPin className="h-5 w-5 text-primary" />
                ) : (
                  <Package className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{locationNameForDisplay}</p>
                <p className="text-xs text-muted-foreground">
                  {target.type === "location"
                    ? `${batchesForLogging.length} batches`
                    : effectiveBatch?.variety || "Batch"}
                </p>
              </div>
              {currentStep === "treatment" && logData && (
                <Badge variant={logData.issue?.severity === "critical" ? "destructive" : "secondary"}>
                  {logData.logType === "issue" ? logData.issue?.reason : "Reading"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {currentStep === "log" && (
          <ScoutLogForm
            locationId={locationForLogging || ""}
            locationName={locationNameForDisplay}
            batches={batchesForLogging}
            onSubmit={handleLogComplete}
            isSubmitting={isSaving}
          />
        )}

        {currentStep === "treatment" && logData && (
          <TreatmentForm
            locationId={locationForLogging || ""}
            locationName={locationNameForDisplay}
            logData={logData}
            suggestedType={getSuggestedTreatmentType(logData)}
            onSubmit={handleTreatmentComplete}
            onSkip={() => handleTreatmentComplete(null)}
            isSubmitting={isSaving}
          />
        )}
      </div>

      {/* Loading overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Saving...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScoutWizardFlow;
