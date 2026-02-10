"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ArrowRight, Loader2, WifiOff } from "lucide-react";
import { useOfflineTaskAction } from "@/hooks/useOfflineTaskAction";
import { useWorkerOffline } from "@/offline/WorkerOfflineProvider";
import { hasPendingStart } from "@/offline/task-queue";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/types/worker-tasks";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface TaskCardWrapperProps {
  task: WorkerTask;
  /** Badge color variant for the task type */
  typeBadgeVariant?: "default" | "secondary" | "outline" | "accent";
  /** Label shown in type badge */
  typeLabel: string;
  /** Main content slots */
  children: React.ReactNode;
  /** Optional footer content (e.g., location) */
  footer?: React.ReactNode;
  /** Callback after task action */
  onUpdate?: () => void;
}

/**
 * Shared wrapper for all task card types
 * Provides consistent layout, status badges, and action buttons
 * Now with offline support - actions are queued when offline
 */
export function TaskCardWrapper({
  task,
  typeBadgeVariant = "secondary",
  typeLabel,
  children,
  footer,
  onUpdate,
}: TaskCardWrapperProps) {
  const { isOnline, getTaskWithOptimisticState } = useWorkerOffline();

  const { startTask, loading } = useOfflineTaskAction({
    haptics: true,
    onSuccess: () => {
      onUpdate?.();
    },
    onError: (error) => {
      toast.error("Failed to start task", { description: error });
    },
  });

  // Apply optimistic state to determine display status
  const optimisticTask = getTaskWithOptimisticState(task);
  const isInProgress = optimisticTask.status === "in_progress";
  const isPendingStart = hasPendingStart(task.id);

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = await startTask(task.id);

    if (result.isQueued) {
      toast.info("Task will start when online", {
        description: "Your action has been queued for sync.",
      });
    }
  };

  return (
    <Link href={`/worker/task/${task.id}`}>
      <Card
        className={cn(
          "transition-all active:scale-[0.98]",
          isInProgress && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <CardContent className="p-4">
          {/* Top row: Type badge + Status badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant={typeBadgeVariant} className="text-xs">
                {typeLabel}
              </Badge>
              {/* Show pending indicator if action is queued */}
              {isPendingStart && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Queued
                </Badge>
              )}
            </div>
            <Badge
              variant={getStatusBadgeVariant(optimisticTask.status)}
              className="text-xs"
            >
              {getStatusLabel(optimisticTask.status)}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base mb-1 line-clamp-2">
            {task.title}
          </h3>

          {/* Module-specific content */}
          <div className="text-sm text-muted-foreground space-y-1">
            {children}
          </div>

          {/* Footer (location, etc.) */}
          {footer && (
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              {footer}
            </div>
          )}

          {/* Action Button - Large touch target */}
          <div className="mt-3">
            {isInProgress ? (
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={(e) => e.preventDefault()}
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Continue
              </Button>
            ) : (
              <Button
                className="w-full h-12 text-base font-semibold"
                variant="secondary"
                onClick={handleStart}
                disabled={loading || isPendingStart}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : !isOnline ? (
                  <>
                    <WifiOff className="mr-2 h-5 w-5" />
                    Start (Offline)
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    Start
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
