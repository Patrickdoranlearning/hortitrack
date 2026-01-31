"use client";

import { Leaf, Layers, Bug } from "lucide-react";
import { TaskCardWrapper } from "./TaskCardWrapper";
import type { WorkerTask, PlantHealthContext } from "@/lib/types/worker-tasks";

interface PlantHealthTaskCardProps {
  task: WorkerTask;
  onUpdate?: () => void;
}

/**
 * Task card for plant health module tasks (IPM, scouting, treatments)
 * Shows: product name, method badge, batch count
 */
export function PlantHealthTaskCard({ task, onUpdate }: PlantHealthTaskCardProps) {
  const context = task.moduleContext as PlantHealthContext | undefined;

  // Method label from context or taskType
  const methodLabel = context?.methodName || task.taskType || "Plant Health";

  return (
    <TaskCardWrapper
      task={task}
      typeLabel={methodLabel}
      typeBadgeVariant="secondary"
      onUpdate={onUpdate}
    >
      {/* Product/Plant Name */}
      {context?.productName && (
        <div className="flex items-center gap-1">
          <Leaf className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{context.productName}</span>
        </div>
      )}

      {/* Plant quantity */}
      {task.plantQuantity && task.plantQuantity > 0 && (
        <div className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          <span>{task.plantQuantity.toLocaleString()} plants</span>
        </div>
      )}

      {/* Batch count */}
      {context?.batchCount && context.batchCount > 0 && (
        <div className="flex items-center gap-1">
          <Bug className="h-3.5 w-3.5" />
          <span>{context.batchCount} batch{context.batchCount !== 1 ? "es" : ""} to treat</span>
        </div>
      )}
    </TaskCardWrapper>
  );
}
