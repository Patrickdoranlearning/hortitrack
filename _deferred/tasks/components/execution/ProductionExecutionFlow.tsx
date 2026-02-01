"use client";

import * as React from "react";
import {
  Play,
  ClipboardCheck,
  Wrench,
  Loader2,
  MapPin,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MobileChecklist, isMobileChecklistComplete } from "../MobileChecklist";
import { PlantCountDialog } from "../PlantCountDialog";
import { ProductivityFeedback } from "../ProductivityFeedback";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import type {
  ChecklistTemplate,
  ChecklistProgress,
} from "@/server/tasks/checklist-service";
import type { ProductionJob, JobBatch } from "@/server/production/jobs";
import { cn } from "@/lib/utils";

type ExecutionStep =
  | "view"
  | "start"
  | "prerequisites"
  | "work"
  | "postrequisites"
  | "count"
  | "complete";

interface ProductionExecutionFlowProps {
  task: WorkerTask;
  job: ProductionJob | null;
  batches: JobBatch[];
  prereqTemplates: ChecklistTemplate[];
  postreqTemplates: ChecklistTemplate[];
  onRefresh: () => Promise<void>;
}

/**
 * Production task execution flow component.
 * Flow: View -> Start -> Prerequisites -> Do Work -> Postrequisites -> Count -> Complete
 */
export function ProductionExecutionFlow({
  task,
  job,
  batches,
  prereqTemplates,
  postreqTemplates,
  onRefresh,
}: ProductionExecutionFlowProps) {
  // Determine initial step based on task status
  const getInitialStep = (): ExecutionStep => {
    if (task.status === "completed") return "complete";
    if (task.status === "in_progress") {
      // Check if prerequisites are done
      if (prereqTemplates.length > 0 && job?.checklistProgress) {
        const prereqStatus = isMobileChecklistComplete(
          prereqTemplates,
          job.checklistProgress,
          "prerequisite"
        );
        if (prereqStatus === "incomplete") return "prerequisites";
      }
      return "work";
    }
    return "view";
  };

  const [currentStep, setCurrentStep] = React.useState<ExecutionStep>(getInitialStep);
  const [checklistProgress, setChecklistProgress] = React.useState<ChecklistProgress>(
    job?.checklistProgress ?? { prerequisites: [], postrequisites: [] }
  );
  const [isStarting, setIsStarting] = React.useState(false);
  const [showCountDialog, setShowCountDialog] = React.useState(false);
  const [completedData, setCompletedData] = React.useState<{
    plantsProcessed: number;
    startedAt: string;
    completedAt: string;
    plantsPerHour: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Update checklist progress when job changes
  React.useEffect(() => {
    if (job?.checklistProgress) {
      setChecklistProgress(job.checklistProgress);
    }
  }, [job?.checklistProgress]);

  const hasPrerequisites = prereqTemplates.length > 0 && prereqTemplates.some(t => t.items.length > 0);
  const hasPostrequisites = postreqTemplates.length > 0 && postreqTemplates.some(t => t.items.length > 0);

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

      // Move to next step
      if (hasPrerequisites) {
        setCurrentStep("prerequisites");
      } else {
        setCurrentStep("work");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start task");
    } finally {
      setIsStarting(false);
    }
  };

  const handleChecklistProgressChange = async (progress: ChecklistProgress) => {
    setChecklistProgress(progress);

    // Save progress to job if we have one
    if (job) {
      try {
        await fetch(`/api/tasks/jobs/${job.id}/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistProgress: progress }),
        });
      } catch {
        // Silent fail - local state is updated
      }
    }
  };

  const handlePrerequisitesComplete = () => {
    setCurrentStep("work");
  };

  const handleWorkComplete = () => {
    if (hasPostrequisites) {
      setCurrentStep("postrequisites");
    } else {
      setCurrentStep("count");
      setShowCountDialog(true);
    }
  };

  const handlePostrequisitesComplete = () => {
    setCurrentStep("count");
    setShowCountDialog(true);
  };

  const handleTaskComplete = async (actualQuantity: number) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualPlantQuantity: actualQuantity }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete task");
      }

      const data = await response.json();
      const completedTask = data.task;

      // Calculate productivity stats
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

  // Render based on current step
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

  if (currentStep === "prerequisites") {
    return (
      <div className="flex flex-col h-full">
        <MobileChecklist
          templates={prereqTemplates}
          progress={checklistProgress}
          checklistType="prerequisite"
          onProgressChange={handleChecklistProgressChange}
          onComplete={handlePrerequisitesComplete}
        />
      </div>
    );
  }

  if (currentStep === "postrequisites") {
    return (
      <div className="flex flex-col h-full">
        <MobileChecklist
          templates={postreqTemplates}
          progress={checklistProgress}
          checklistType="postrequisite"
          onProgressChange={handleChecklistProgressChange}
          onComplete={handlePostrequisitesComplete}
        />
      </div>
    );
  }

  // View or Work step - show job details
  return (
    <div className="flex flex-col min-h-full">
      {/* Job Details */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {job?.processType || task.taskType || "Production"}
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

        {/* Job info */}
        <div className="grid grid-cols-2 gap-4">
          {task.plantQuantity && task.plantQuantity > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Plants</p>
                  <p className="font-semibold">{task.plantQuantity.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {job?.location && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-semibold">{job.location}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {job?.machine && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Machine</p>
                  <p className="font-semibold">{job.machine}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Batches list */}
        {batches.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Batches ({batches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-64 overflow-y-auto">
                {batches.map((batch) => (
                  <div
                    key={batch.batchId}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {batch.varietyName || "Unknown Variety"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.batchNumber} {batch.sizeName && `- ${batch.sizeName}`}
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

        {/* Checklist summary (if already started) */}
        {currentStep === "work" && (hasPrerequisites || hasPostrequisites) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Checklists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {hasPrerequisites && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Prerequisites</span>
                  <ChecklistStatusBadge
                    status={isMobileChecklistComplete(
                      prereqTemplates,
                      checklistProgress,
                      "prerequisite"
                    )}
                  />
                </div>
              )}
              {hasPostrequisites && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Postrequisites</span>
                  <ChecklistStatusBadge
                    status={isMobileChecklistComplete(
                      postreqTemplates,
                      checklistProgress,
                      "postrequisite"
                    )}
                  />
                </div>
              )}
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
                Start Task
              </>
            )}
          </Button>
        ) : currentStep === "work" ? (
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleWorkComplete}
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            {hasPostrequisites ? "Continue to Postrequisites" : "Complete Task"}
          </Button>
        ) : null}
      </div>

      {/* Plant Count Dialog */}
      <PlantCountDialog
        open={showCountDialog}
        onOpenChange={setShowCountDialog}
        expectedQuantity={task.plantQuantity || job?.totalPlants || 0}
        startedAt={task.startedAt}
        onComplete={handleTaskComplete}
      />
    </div>
  );
}

function ChecklistStatusBadge({ status }: { status: "incomplete" | "complete" | "skipped_with_warnings" }) {
  return (
    <Badge
      variant={status === "complete" ? "default" : status === "skipped_with_warnings" ? "secondary" : "outline"}
      className={cn(
        "text-xs",
        status === "complete" && "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
        status === "skipped_with_warnings" && "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
      )}
    >
      {status === "complete" && "Done"}
      {status === "skipped_with_warnings" && "Skipped"}
      {status === "incomplete" && "Pending"}
    </Badge>
  );
}
