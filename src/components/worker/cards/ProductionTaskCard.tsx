"use client";

import { Layers, MapPin } from "lucide-react";
import { TaskCardWrapper } from "./TaskCardWrapper";
import type { WorkerTask, ProductionContext } from "@/lib/types/worker-tasks";

interface ProductionTaskCardProps {
  task: WorkerTask;
  onUpdate?: () => void;
}

/**
 * Task card for production module tasks
 * Shows: job name, process type badge, batch count, location
 */
export function ProductionTaskCard({ task, onUpdate }: ProductionTaskCardProps) {
  const context = task.moduleContext as ProductionContext | undefined;

  // Determine process type label from context or taskType
  const processType = context?.processType || task.taskType || "Production";

  return (
    <TaskCardWrapper
      task={task}
      typeLabel={processType}
      typeBadgeVariant="default"
      onUpdate={onUpdate}
      footer={
        context?.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{context.location}</span>
          </div>
        )
      }
    >
      {/* Job Name if available */}
      {context?.jobName && (
        <p className="font-medium text-foreground">{context.jobName}</p>
      )}

      {/* Plant quantity */}
      {task.plantQuantity && task.plantQuantity > 0 && (
        <div className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          <span>{task.plantQuantity.toLocaleString()} plants</span>
        </div>
      )}

      {/* Batch count if available */}
      {context?.batchCount && context.batchCount > 0 && (
        <div className="flex items-center gap-1">
          <span>{context.batchCount} batch{context.batchCount !== 1 ? "es" : ""}</span>
        </div>
      )}
    </TaskCardWrapper>
  );
}
