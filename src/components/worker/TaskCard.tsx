"use client";

import type { WorkerTask } from "@/lib/types/worker-tasks";
import { ProductionTaskCard } from "./cards/ProductionTaskCard";
import { DispatchTaskCard } from "./cards/DispatchTaskCard";
import { PlantHealthTaskCard } from "./cards/PlantHealthTaskCard";
import { GenericTaskCard } from "./cards/GenericTaskCard";

interface TaskCardProps {
  task: WorkerTask;
  onUpdate?: () => void;
}

/**
 * Task card that delegates to module-specific card components
 */
export function TaskCard({ task, onUpdate }: TaskCardProps) {
  switch (task.sourceModule) {
    case "production":
      return <ProductionTaskCard task={task} onUpdate={onUpdate} />;
    case "dispatch":
      return <DispatchTaskCard task={task} onUpdate={onUpdate} />;
    case "plant_health":
      return <PlantHealthTaskCard task={task} onUpdate={onUpdate} />;
    default:
      return <GenericTaskCard task={task} onUpdate={onUpdate} />;
  }
}
