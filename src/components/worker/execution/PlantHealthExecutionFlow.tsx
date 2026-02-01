"use client";

import * as React from "react";
import {
  Play,
  CheckCircle2,
  Loader2,
  Leaf,
  Droplets,
  Bug,
  FileText,
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PlantCountDialog } from "../PlantCountDialog";
import { ProductivityFeedback } from "../ProductivityFeedback";
import type { WorkerTask, PlantHealthContext } from "@/lib/types/worker-tasks";

type ExecutionStep = "view" | "start" | "apply" | "record" | "count" | "complete";

interface IpmTaskDetails {
  id: string;
  method: string | null;
  productName: string | null;
  productRate: string | null;
  productUnit: string | null;
  notes: string | null;
  batchCount: number;
  batches: Array<{
    batchId: string;
    batchNumber: string | null;
    varietyName: string | null;
    quantity: number;
  }>;
}

interface PlantHealthExecutionFlowProps {
  task: WorkerTask;
  ipmTask: IpmTaskDetails | null;
  onRefresh: () => Promise<void>;
}

/**
 * Plant health/IPM task execution flow component.
 * Flow: View -> Start -> Apply Treatment -> Record Compliance -> Count -> Complete
 */
export function PlantHealthExecutionFlow({
  task,
  ipmTask,
  onRefresh,
}: PlantHealthExecutionFlowProps) {
  const getInitialStep = (): ExecutionStep => {
    if (task.status === "completed") return "complete";
    if (task.status === "in_progress") return "apply";
    return "view";
  };

  const [currentStep, setCurrentStep] = React.useState<ExecutionStep>(getInitialStep);
  const [isStarting, setIsStarting] = React.useState(false);
  const [complianceNotes, setComplianceNotes] = React.useState("");
  const [showCountDialog, setShowCountDialog] = React.useState(false);
  const [completedData, setCompletedData] = React.useState<{
    plantsProcessed: number;
    startedAt: string;
    completedAt: string;
    plantsPerHour: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const context = task.moduleContext as PlantHealthContext | undefined;

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start task");
      }

      await onRefresh();
      setCurrentStep("apply");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start task");
    } finally {
      setIsStarting(false);
    }
  };

  const handleApplyComplete = () => {
    setCurrentStep("record");
  };

  const handleRecordComplete = () => {
    setCurrentStep("count");
    setShowCountDialog(true);
  };

  const handleTaskComplete = async (actualQuantity: number) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualPlantQuantity: actualQuantity,
          complianceNotes: complianceNotes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete task");
      }

      const data = await response.json();
      const completedTask = data.task;

      const startedAt = task.startedAt || new Date().toISOString();
      const completedAt = completedTask.completedAt || new Date().toISOString();
      const durationMinutes = Math.round(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000 / 60
      );
      const plantsPerHour = durationMinutes > 0
        ? Math.round((actualQuantity / durationMinutes) * 60)
        : 0;

      setCompletedData({
        plantsProcessed: actualQuantity,
        startedAt,
        completedAt,
        plantsPerHour,
      });

      setShowCountDialog(false);
      setCurrentStep("complete");
    } catch (err) {
      throw err;
    }
  };

  // Render complete screen
  if (currentStep === "complete" && completedData) {
    return (
      <ProductivityFeedback
        plantsProcessed={completedData.plantsProcessed}
        startedAt={completedData.startedAt}
        completedAt={completedData.completedAt}
        plantsPerHour={completedData.plantsPerHour}
      />
    );
  }

  // Render record compliance screen
  if (currentStep === "record") {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 dark:bg-green-900/50 rounded-full p-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Treatment Applied</h2>
              <p className="text-sm text-muted-foreground">Record compliance details</p>
            </div>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Compliance Notes (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any notes about the application, conditions, observations..."
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                rows={4}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium">{ipmTask?.productName || context?.productName || "-"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{ipmTask?.method || context?.methodName || "-"}</span>
              </div>
              {ipmTask?.productRate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium">
                    {ipmTask.productRate} {ipmTask.productUnit || ""}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Batches Treated</span>
                <span className="font-medium">{ipmTask?.batchCount || context?.batchCount || "-"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 border-t bg-background safe-area-inset-bottom">
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleRecordComplete}
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // View or Apply step - show treatment details
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 py-4 space-y-4 overflow-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {ipmTask?.method || context?.methodName || "IPM"}
            </Badge>
            <Badge
              variant={task.status === "in_progress" ? "default" : "outline"}
              className="text-xs"
            >
              {task.status === "in_progress" ? "In Progress" : "Assigned"}
            </Badge>
          </div>
          <h1 className="text-xl font-bold">{task.title}</h1>
          {task.description && (
            <p className="text-muted-foreground mt-1">{task.description}</p>
          )}
        </div>

        <Separator />

        {/* Treatment details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Treatment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(ipmTask?.productName || context?.productName) && (
              <div className="flex items-center gap-3">
                <Leaf className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-semibold">{ipmTask?.productName || context?.productName}</p>
                </div>
              </div>
            )}

            {ipmTask?.productRate && (
              <div className="flex items-center gap-3">
                <Droplets className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Rate</p>
                  <p className="font-semibold">
                    {ipmTask.productRate} {ipmTask.productUnit || ""}
                  </p>
                </div>
              </div>
            )}

            {(ipmTask?.method || context?.methodName) && (
              <div className="flex items-center gap-3">
                <Bug className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Method</p>
                  <p className="font-semibold capitalize">
                    {ipmTask?.method || context?.methodName}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plant quantity */}
        {task.plantQuantity && task.plantQuantity > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Plants to Treat</p>
                <p className="font-semibold">{task.plantQuantity.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batches list */}
        {ipmTask?.batches && ipmTask.batches.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Batches to Treat ({ipmTask.batches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-64 overflow-y-auto">
                {ipmTask.batches.map((batch) => (
                  <div
                    key={batch.batchId}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {batch.varietyName || "Unknown Variety"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.batchNumber}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {batch.quantity.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {ipmTask?.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{ipmTask.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom action button */}
      <div className="p-4 border-t bg-background safe-area-inset-bottom">
        {currentStep === "view" ? (
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Start Treatment
              </>
            )}
          </Button>
        ) : currentStep === "apply" ? (
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleApplyComplete}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Treatment Applied
          </Button>
        ) : null}
      </div>

      {/* Plant Count Dialog */}
      <PlantCountDialog
        open={showCountDialog}
        onOpenChange={setShowCountDialog}
        expectedQuantity={task.plantQuantity || 0}
        startedAt={task.startedAt}
        onComplete={handleTaskComplete}
      />
    </div>
  );
}
