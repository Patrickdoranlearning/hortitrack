"use client";

import { Package, User } from "lucide-react";
import { TaskCardWrapper } from "./TaskCardWrapper";
import { Progress } from "@/components/ui/progress";
import type { WorkerTask, DispatchContext } from "@/lib/types/worker-tasks";

interface DispatchTaskCardProps {
  task: WorkerTask;
  onUpdate?: () => void;
}

/**
 * Task card for dispatch module tasks (picking)
 * Shows: order number, customer, progress bar
 */
export function DispatchTaskCard({ task, onUpdate }: DispatchTaskCardProps) {
  const context = task.moduleContext as DispatchContext | undefined;

  // Calculate progress percentage
  const itemsPicked = context?.itemsPicked ?? 0;
  const itemsTotal = context?.itemsTotal ?? 0;
  const progressPercent = itemsTotal > 0 ? Math.round((itemsPicked / itemsTotal) * 100) : 0;

  return (
    <TaskCardWrapper
      task={task}
      typeLabel="Picking"
      typeBadgeVariant="accent"
      onUpdate={onUpdate}
    >
      {/* Order Number */}
      {context?.orderNumber && (
        <div className="flex items-center gap-1">
          <Package className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{context.orderNumber}</span>
        </div>
      )}

      {/* Customer Name */}
      {context?.customerName && (
        <div className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          <span>{context.customerName}</span>
        </div>
      )}

      {/* Progress Bar */}
      {itemsTotal > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span>Progress</span>
            <span className="font-medium">
              {itemsPicked} / {itemsTotal} items
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}
    </TaskCardWrapper>
  );
}
