import type { Task, TaskStatus, SourceModule } from "@/server/tasks/service";

/**
 * Extended task with module-specific context for the worker app
 */
export interface WorkerTask extends Task {
  /** Additional context based on sourceModule */
  moduleContext?: ProductionContext | DispatchContext | PlantHealthContext;
}

export interface ProductionContext {
  type: "production";
  jobName?: string;
  processType?: string;
  batchCount?: number;
  location?: string;
}

export interface DispatchContext {
  type: "dispatch";
  orderNumber?: string;
  customerName?: string;
  itemsTotal?: number;
  itemsPicked?: number;
}

export interface PlantHealthContext {
  type: "plant_health";
  productName?: string;
  methodName?: string;
  batchCount?: number;
}

export type ModuleContext = ProductionContext | DispatchContext | PlantHealthContext;

/**
 * API response type for worker tasks endpoint
 */
export interface WorkerTasksResponse {
  tasks: WorkerTask[];
  stats: TaskStats;
}

export interface TaskStats {
  pending: number;
  inProgress: number;
  completedToday: number;
}

/**
 * Task grouping for display
 */
export interface GroupedTasks {
  inProgress: WorkerTask[];
  assigned: WorkerTask[];
  pending: WorkerTask[];
}

/**
 * Helper to group tasks by status for display
 */
export function groupTasksByStatus(tasks: WorkerTask[]): GroupedTasks {
  const inProgress: WorkerTask[] = [];
  const assigned: WorkerTask[] = [];
  const pending: WorkerTask[] = [];

  for (const task of tasks) {
    switch (task.status) {
      case "in_progress":
        inProgress.push(task);
        break;
      case "assigned":
        assigned.push(task);
        break;
      case "pending":
        pending.push(task);
        break;
      // completed and cancelled are not shown in the main list
    }
  }

  return { inProgress, assigned, pending };
}

/**
 * Get display label for source module
 */
export function getModuleLabel(module: SourceModule): string {
  switch (module) {
    case "production":
      return "Production";
    case "dispatch":
      return "Dispatch";
    case "plant_health":
      return "Plant Health";
    default:
      return "Task";
  }
}

/**
 * Get badge variant for task status
 */
export function getStatusBadgeVariant(status: TaskStatus): "default" | "secondary" | "outline" {
  switch (status) {
    case "in_progress":
      return "default";
    case "assigned":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Get display label for task status
 */
export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "assigned":
      return "Assigned";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
