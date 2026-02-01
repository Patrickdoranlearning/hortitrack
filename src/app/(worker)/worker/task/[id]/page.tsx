"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlantHealthExecutionFlow } from "@/components/worker/execution";
import type { WorkerTask } from "@/lib/types/worker-tasks";

interface TaskDetailData {
  task: WorkerTask;
  // Plant health-specific
  ipmTask?: {
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
  } | null;
}

export default function WorkerTaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [data, setData] = React.useState<TaskDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTask = React.useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/worker/task/${taskId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load task");
      }

      const taskData = await response.json();
      setData(taskData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  React.useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleRefresh = async () => {
    await fetchTask();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading task...</p>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="px-4 py-8">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="min-h-[44px] -ml-2">
            <Link href="/worker">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="bg-destructive/10 rounded-full p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Unable to Load Task</h2>
          <p className="text-muted-foreground text-sm max-w-xs mb-6">
            {error || "The task could not be found or you don't have access."}
          </p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { task } = data;

  // Render module-specific execution flow
  return (
    <div className="flex flex-col min-h-full">
      {/* Back navigation */}
      <div className="px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="sm" asChild className="min-h-[44px] -ml-2">
          <Link href="/worker">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      {/* Execution Flow based on module */}
      <div className="flex-1 overflow-hidden">
        {task.sourceModule === "plant_health" && (
          <PlantHealthExecutionFlow
            task={task}
            ipmTask={data.ipmTask ?? null}
            onRefresh={handleRefresh}
          />
        )}

        {/* Fallback for deferred modules (production, dispatch, generic) */}
        {task.sourceModule !== "plant_health" && (
          <DeferredModuleFallback task={task} onRefresh={handleRefresh} />
        )}
      </div>
    </div>
  );
}

/**
 * Fallback for task modules that have been deferred
 * Shows a simple start/complete flow for backward compatibility
 */
function DeferredModuleFallback({
  task,
  onRefresh,
}: {
  task: WorkerTask;
  onRefresh: () => Promise<void>;
}) {
  const [isStarting, setIsStarting] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start task");
    } finally {
      setIsStarting(false);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete task");
      }

      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 py-6">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Full task workflow for {task.sourceModule} tasks coming soon.
            Basic start/complete available below.
          </p>
        </div>

        <h1 className="text-xl font-bold mb-2">{task.title}</h1>
        {task.description && (
          <p className="text-muted-foreground mb-4">{task.description}</p>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 mt-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-background safe-area-inset-bottom">
        {task.status === "assigned" || task.status === "pending" ? (
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
              "Start Task"
            )}
          </Button>
        ) : task.status === "in_progress" ? (
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Completing...
              </>
            ) : (
              "Complete Task"
            )}
          </Button>
        ) : task.status === "completed" ? (
          <div className="text-center text-green-600 font-medium py-4">
            Task Completed
          </div>
        ) : null}
      </div>
    </div>
  );
}
