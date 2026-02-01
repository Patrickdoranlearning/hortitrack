"use client";

import type { WorkerTask } from "@/lib/types/worker-tasks";
import { PlantHealthTaskCard } from "./cards/PlantHealthTaskCard";

interface TaskCardProps {
  task: WorkerTask;
  onUpdate?: () => void;
}

/**
 * Task card that delegates to module-specific card components
 * Note: Production and Dispatch task cards deferred to future release
 */
export function TaskCard({ task, onUpdate }: TaskCardProps) {
  // Currently only plant_health tasks are supported in the worker app
  if (task.sourceModule === "plant_health") {
    return <PlantHealthTaskCard task={task} onUpdate={onUpdate} />;
  }

  // Fallback for deferred modules (production, dispatch, generic)
  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">
        {task.title || "Task"} ({task.sourceModule})
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Task management for this module coming soon
      </p>
    </div>
  );
}
