"use client";

import { Layers, Calendar } from "lucide-react";
import { TaskCardWrapper } from "./TaskCardWrapper";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import { getModuleLabel } from "@/lib/types/worker-tasks";

interface GenericTaskCardProps {
  task: WorkerTask;
  onUpdate?: () => void;
}

/**
 * Fallback task card for unknown task types
 * Shows: module label, description, plant count, scheduled date
 */
export function GenericTaskCard({ task, onUpdate }: GenericTaskCardProps) {
  // Format scheduled date if present
  const scheduledDate = task.scheduledDate
    ? new Date(task.scheduledDate).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <TaskCardWrapper
      task={task}
      typeLabel={task.taskType || getModuleLabel(task.sourceModule)}
      typeBadgeVariant="outline"
      onUpdate={onUpdate}
    >
      {/* Description if available */}
      {task.description && (
        <p className="line-clamp-2">{task.description}</p>
      )}

      {/* Plant quantity */}
      {task.plantQuantity && task.plantQuantity > 0 && (
        <div className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          <span>{task.plantQuantity.toLocaleString()} plants</span>
        </div>
      )}

      {/* Scheduled date */}
      {scheduledDate && (
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{scheduledDate}</span>
        </div>
      )}
    </TaskCardWrapper>
  );
}
