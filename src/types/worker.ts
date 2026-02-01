// src/types/worker.ts
// Shared types for worker app - can be imported by both client and server

/**
 * Material detail response for worker app
 */
export type WorkerMaterialDetail = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  categoryName: string;
  categoryCode: string;
  uom: string;
  totalStock: number;
  reorderPoint: number | null;
  isLowStock: boolean;
  stockByLocation: {
    locationId: string | null;
    locationName: string;
    onHand: number;
    reserved: number;
    available: number;
  }[];
  lots: {
    id: string;
    lotNumber: string;
    quantity: number;
    expiryDate: string | null;
    locationName: string | null;
    supplierLotNumber: string | null;
    status: string;
  }[];
};

/**
 * Scout log entry for worker app
 */
export interface WorkerScoutLog {
  id: string;
  batchId: string | null;
  batchNumber: string | null;
  varietyName: string | null;
  locationId: string | null;
  locationName: string | null;
  issueType: string | null;
  severity: string | null;
  affectedPercent: number | null;
  notes: string | null;
  photoUrl: string | null;
  isAllClear: boolean;
  createdAt: string;
}

/**
 * Scout statistics
 */
export interface WorkerScoutStats {
  scoutedToday: number;
  issuesFoundToday: number;
}

/**
 * Get scouts API response
 */
export interface GetScoutsResponse {
  scouts: WorkerScoutLog[];
  stats: WorkerScoutStats;
}

/**
 * Stats summary
 */
export interface StatsSummary {
  tasksCompleted: number;
  plantsProcessed: number;
  avgPlantsPerHour: number | null;
  totalMinutesWorked: number;
}

/**
 * Comparison with previous period
 */
export interface StatsComparison {
  previousTasksCompleted: number;
  previousPlantsProcessed: number;
  previousAvgPlantsPerHour: number | null;
  changePercent: number | null;
}

/**
 * Task breakdown by module
 */
export interface TaskBreakdown {
  production: number;
  dispatch: number;
  plantHealth: number;
}

/**
 * History entry for chart
 */
export interface HistoryEntry {
  date: string;
  tasksCompleted: number;
  plantsProcessed: number;
}

/**
 * Stats API response
 */
export interface StatsResponse {
  summary: StatsSummary;
  comparison: StatsComparison | null;
  breakdown: TaskBreakdown;
  history: HistoryEntry[];
}

/**
 * Location for worker app
 */
export interface WorkerLocation {
  id: string;
  name: string;
  nurserySite: string | null;
  type: string | null;
  covered: boolean;
  area: number | null;
  siteId: string | null;
  batchCount: number;
  totalQuantity: number;
  capacityPercent: number | null;
}

/**
 * Locations API response
 */
export interface WorkerLocationsResponse {
  items: WorkerLocation[];
  total: number;
}

/**
 * Team member detail for worker app
 */
export type TeamMemberDetail = {
  id: string;
  name: string;
  avatarInitials: string;
  currentTask: {
    id: string;
    title: string;
    startedAt: string;
    durationMinutes: number;
  } | null;
  tasksCompletedToday: number;
  recentTasks: {
    id: string;
    title: string;
    status: string;
    completedAt: string | null;
  }[];
};

/**
 * Health status level for batch health indicators
 */
export type HealthStatusLevel = "healthy" | "attention" | "critical" | "unknown";

/**
 * Batch for worker app list view
 */
export type WorkerBatch = {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  familyName: string | null;
  sizeName: string | null;
  locationId: string | null;
  locationName: string | null;
  status: string | null;
  phase: string | null;
  quantity: number;
  initialQuantity: number;
  // Health status (optional, included when includeHealth=true)
  healthLevel?: HealthStatusLevel;
  activeIssuesCount?: number;
};

/**
 * Batch detail for worker app
 */
export type WorkerBatchDetail = {
  id: string;
  batchNumber: string;
  varietyId: string | null;
  varietyName: string | null;
  familyName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  locationId: string | null;
  locationName: string | null;
  status: string | null;
  phase: string | null;
  quantity: number;
  initialQuantity: number;
  plantedAt: string | null;
  readyAt: string | null;
  supplierName: string | null;
  notes: string | null;
  createdAt: string | null;
};

/**
 * Team member in "right now" list
 */
export type TeamMember = {
  id: string;
  name: string;
  avatarInitials: string;
  currentTask: {
    id: string;
    title: string;
    startedAt: string;
    durationMinutes: number;
  } | null;
};

/**
 * Completed task entry
 */
export type CompletedTask = {
  id: string;
  title: string;
  completedBy: string;
  completedByName: string;
  completedAt: string;
};

/**
 * Team activity API response
 */
export type TeamActivityResponse = {
  rightNow: TeamMember[];
  completedToday: CompletedTask[];
  myStats: {
    completedToday: number;
    teamAverage: number;
  };
};

/**
 * Schedule day with tasks
 */
export interface ScheduleDay {
  date: string;
  dayName: string;
  isToday: boolean;
  tasks: import("@/lib/types/worker-tasks").WorkerTask[];
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
}

/**
 * Schedule API response
 */
export interface ScheduleResponse {
  weekStart: string;
  weekEnd: string;
  days: ScheduleDay[];
}
