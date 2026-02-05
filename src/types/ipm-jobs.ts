/**
 * IPM Jobs - Types for spray job management
 * Jobs group related IPM tasks for a single spray run
 */

export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export type IpmJob = {
  id: string;
  orgId: string;
  name: string;
  groupKey: string;
  scheduledDate: string;
  calendarWeek: number;
  status: JobStatus;

  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: string;
  assignedBy?: string;
  scoutNotes?: string;
  priority: JobPriority;

  // Execution
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;

  // Compliance (job-level)
  weatherConditions?: string;
  sprayerUsed?: string;
  totalVolumeMl?: number;
  bottleId?: string;
  quantityUsedMl?: number;
  signedBy?: string;
  notes?: string;

  // Aggregated data (from tasks)
  taskCount: number;
  completedTaskCount: number;
  locationCount: number;
  batchCount: number;
  locations: JobLocation[];
  product: JobProduct;

  createdAt: string;
  updatedAt: string;
};

export type JobLocation = {
  id: string;
  name: string;
  taskCount: number;
  completedCount: number;
  batches: JobBatch[];
};

export type JobBatch = {
  id: string;
  batchNumber: string;
  variety?: string;
  taskId: string;
  isCompleted: boolean;
};

export type JobProduct = {
  id: string;
  name: string;
  pcsNumber?: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  harvestIntervalDays?: number;
  isTankMix: boolean;
  tankMixProducts?: string[];
};

export type CreateJobInput = {
  groupKey: string;
  calendarWeek: number;
  scheduledDate: string;
  name?: string;
};

export type AssignJobInput = {
  jobId: string;
  assignedTo: string;
  scoutNotes?: string;
  priority?: JobPriority;
};

export type CompleteJobInput = {
  jobId: string;
  weatherConditions?: string;
  sprayerUsed?: string;
  totalVolumeMl?: number;
  bottleId?: string;
  quantityUsedMl?: number;
  signedBy: string;
  notes?: string;
};

// For the Kanban board grouping
export type JobsByStatus = {
  pending: IpmJob[];
  assigned: IpmJob[];
  inProgress: IpmJob[];
  completed: IpmJob[];
};
