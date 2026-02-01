"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  Package,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import {
  getStatusLabel,
  getStatusBadgeVariant,
  getModuleLabel,
} from "@/lib/types/worker-tasks";
import { cn } from "@/lib/utils";
import { vibrateSuccess } from "@/lib/haptics";
import { logError } from "@/lib/log";

interface BatchInfo {
  id: string;
  batchNumber: string | null;
  varietyName: string | null;
}

interface MaterialInfo {
  id: string;
  partNumber: string;
  name: string;
  categoryName: string | null;
  totalStock: number;
  uom: string;
}

interface ScanResultProps {
  loading: boolean;
  found: boolean;
  task?: WorkerTask;
  suggestions?: WorkerTask[];
  batch?: BatchInfo;
  material?: MaterialInfo;
  message?: string;
  error?: string | null;
  onRetry: () => void;
  onManualSearch: () => void;
}

/**
 * Displays scan results with appropriate UI for different states
 */
export function ScanResult({
  loading,
  found,
  task,
  suggestions,
  batch,
  material,
  message,
  error,
  onRetry,
  onManualSearch,
}: ScanResultProps) {
  const router = useRouter();
  const [startingTaskId, setStartingTaskId] = React.useState<string | null>(
    null
  );

  // Trigger haptic feedback on successful find
  React.useEffect(() => {
    if (found && (task || material)) {
      vibrateSuccess();
    }
  }, [found, task, material]);

  const handleStartTask = async (taskToStart: WorkerTask) => {
    try {
      setStartingTaskId(taskToStart.id);

      // If already in progress, just navigate
      if (taskToStart.status === "in_progress") {
        router.push(`/worker/task/${taskToStart.id}`);
        return;
      }

      // Start the task
      const response = await fetch(`/api/tasks/${taskToStart.id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start task");
      }

      // Navigate to task detail
      router.push(`/worker/task/${taskToStart.id}`);
    } catch (err) {
      // Show error but don't block navigation
      logError("[ScanResult] Failed to start task", { error: err, taskId: taskToStart.id });
      router.push(`/worker/task/${taskToStart.id}`);
    } finally {
      setStartingTaskId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-center">Looking up task...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="bg-destructive/10 rounded-full p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Scan Error</h3>
        <p className="text-muted-foreground text-center text-sm mb-6 max-w-xs">
          {error}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button variant="secondary" onClick={onManualSearch}>
            Search Manually
          </Button>
        </div>
      </div>
    );
  }

  // Found material
  if (found && material) {
    return (
      <div className="px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Material Found</span>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary" className="text-xs">
                {material.categoryName || "Material"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {material.partNumber}
              </span>
            </div>

            <h3 className="font-semibold text-lg mb-3">{material.name}</h3>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
              <span className="text-muted-foreground">Stock Level</span>
              <span className="font-semibold text-lg">
                {material.totalStock.toLocaleString()} {material.uom}
              </span>
            </div>

            <Button
              className="w-full h-14 text-lg font-semibold"
              onClick={() => router.push(`/worker/materials/${material.id}`)}
            >
              <ArrowRight className="mr-2 h-5 w-5" />
              View Details
            </Button>
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-full" onClick={onRetry}>
          Scan Another
        </Button>
      </div>
    );
  }

  // Found single task
  if (found && task) {
    const isInProgress = task.status === "in_progress";

    return (
      <div className="px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Task Found</span>
        </div>

        {batch && (
          <BatchInfoCard batch={batch} />
        )}

        <Card className={cn(isInProgress && "ring-2 ring-primary ring-offset-2")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary" className="text-xs">
                {getModuleLabel(task.sourceModule)}
              </Badge>
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className="text-xs"
              >
                {getStatusLabel(task.status)}
              </Badge>
            </div>

            <h3 className="font-semibold text-lg mb-1">{task.title}</h3>

            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {task.description}
              </p>
            )}

            <TaskContextInfo task={task} />

            <Button
              className="w-full h-14 text-lg font-semibold mt-4"
              onClick={() => handleStartTask(task)}
              disabled={startingTaskId === task.id}
            >
              {startingTaskId === task.id ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isInProgress ? "Opening..." : "Starting..."}
                </>
              ) : isInProgress ? (
                <>
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Continue Task
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Start Task
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          className="w-full"
          onClick={onRetry}
        >
          Scan Another
        </Button>
      </div>
    );
  }

  // Multiple suggestions
  if (suggestions && suggestions.length > 0) {
    return (
      <div className="px-4 py-6 space-y-4">
        <div className="text-center mb-4">
          <h3 className="font-semibold text-lg">
            {message || `Found ${suggestions.length} tasks`}
          </h3>
          <p className="text-sm text-muted-foreground">
            Select the task you want to work on
          </p>
        </div>

        {batch && (
          <BatchInfoCard batch={batch} />
        )}

        <div className="space-y-3">
          {suggestions.map((suggestedTask) => (
            <SuggestionCard
              key={suggestedTask.id}
              task={suggestedTask}
              onStart={() => handleStartTask(suggestedTask)}
              isStarting={startingTaskId === suggestedTask.id}
            />
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Scan Again
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onManualSearch}
          >
            Search
          </Button>
        </div>
      </div>
    );
  }

  // Not found
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="bg-muted rounded-full p-4 mb-4">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>

      {batch ? (
        <>
          <h3 className="font-semibold text-lg mb-2">No Pending Tasks</h3>
          <BatchInfoCard batch={batch} className="mb-4" />
          <p className="text-muted-foreground text-center text-sm max-w-xs">
            {message || "This batch has no pending tasks assigned to you."}
          </p>
        </>
      ) : (
        <>
          <h3 className="font-semibold text-lg mb-2">Not Found</h3>
          <p className="text-muted-foreground text-center text-sm max-w-xs mb-6">
            {message || "Could not find any tasks for this code."}
          </p>
        </>
      )}

      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Scan Again
        </Button>
        <Button variant="secondary" onClick={onManualSearch}>
          Search Manually
        </Button>
      </div>
    </div>
  );
}

/**
 * Displays batch information
 */
function BatchInfoCard({
  batch,
  className,
}: {
  batch: BatchInfo;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 bg-muted/50 rounded-lg",
        className
      )}
    >
      <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="font-medium truncate">
          Batch #{batch.batchNumber || "Unknown"}
        </p>
        {batch.varietyName && (
          <p className="text-sm text-muted-foreground truncate">
            {batch.varietyName}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Displays task context based on module type
 */
function TaskContextInfo({ task }: { task: WorkerTask }) {
  const context = task.moduleContext;
  if (!context) return null;

  switch (context.type) {
    case "production":
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          {context.processType && <p>Process: {context.processType}</p>}
          {context.batchCount !== undefined && context.batchCount > 0 && (
            <p>
              {context.batchCount} batch{context.batchCount !== 1 ? "es" : ""}
            </p>
          )}
          {context.location && <p>Location: {context.location}</p>}
        </div>
      );

    case "dispatch":
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          {context.orderNumber && <p>Order: {context.orderNumber}</p>}
          {context.customerName && <p>Customer: {context.customerName}</p>}
          {context.itemsTotal !== undefined && (
            <p>
              Progress: {context.itemsPicked ?? 0}/{context.itemsTotal} items
            </p>
          )}
        </div>
      );

    case "plant_health":
      return (
        <div className="text-sm text-muted-foreground space-y-1">
          {context.methodName && <p>Method: {context.methodName}</p>}
          {context.productName && <p>Product: {context.productName}</p>}
          {context.batchCount !== undefined && context.batchCount > 0 && (
            <p>
              {context.batchCount} batch{context.batchCount !== 1 ? "es" : ""}
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}

/**
 * Compact task card for suggestions list
 */
function SuggestionCard({
  task,
  onStart,
  isStarting,
}: {
  task: WorkerTask;
  onStart: () => void;
  isStarting: boolean;
}) {
  const isInProgress = task.status === "in_progress";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all active:scale-[0.98]",
        isInProgress && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onStart}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {getModuleLabel(task.sourceModule)}
              </Badge>
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className="text-xs flex-shrink-0"
              >
                {getStatusLabel(task.status)}
              </Badge>
            </div>
            <h4 className="font-medium line-clamp-2">{task.title}</h4>
            <TaskContextInfo task={task} />
          </div>

          <Button
            size="icon"
            className="h-12 w-12 flex-shrink-0"
            disabled={isStarting}
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
          >
            {isStarting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isInProgress ? (
              <ArrowRight className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

