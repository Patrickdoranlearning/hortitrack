// Guide Plans & Batch Plans types for Production Planning Hierarchy

export type GuidePlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type BatchPlanStatus = 'draft' | 'active' | 'completed';

// ============================================================================
// Guide Plan - High-level production target (Family + Size level)
// ============================================================================
export type GuidePlan = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;

  // Target
  targetFamily: string;
  targetSizeId: string | null;
  targetSizeName?: string | null;

  // Timeline (absolute years)
  readyFromWeek: number;
  readyFromYear: number;
  readyToWeek: number;
  readyToYear: number;

  // Recipe link
  protocolId: string | null;
  protocolName?: string | null;

  // Quantity
  targetQuantity: number;

  // Status
  status: GuidePlanStatus;

  createdAt: string;
  updatedAt: string;
};

export type GuidePlanProgress = {
  targetQuantity: number;
  totalPlanned: number;       // Sum of batch_plans.planned_quantity
  totalInBatches: number;     // Sum of batches (not archived/dumped)
  totalCompleted: number;     // Sum of batches with status Ready/Shipped
  percentPlanned: number;     // (totalPlanned / targetQuantity) * 100
  percentInBatches: number;   // (totalInBatches / targetQuantity) * 100
  percentComplete: number;    // (totalCompleted / targetQuantity) * 100
};

export type GuidePlanWithProgress = GuidePlan & {
  progress: GuidePlanProgress;
  batchPlanCount?: number;
};

// ============================================================================
// Batch Plan - Variety-level breakdown
// ============================================================================
export type BatchPlan = {
  id: string;
  orgId: string;
  guidePlanId: string | null;

  // Target
  plantVarietyId: string;
  plantVarietyName?: string | null;
  plantVarietyFamily?: string | null;
  targetSizeId: string | null;
  targetSizeName?: string | null;

  // Quantity
  plannedQuantity: number;

  // Timeline (can inherit from guide plan)
  readyFromWeek: number | null;
  readyFromYear: number | null;
  readyToWeek: number | null;
  readyToYear: number | null;

  // Recipe link
  protocolId: string | null;
  protocolName?: string | null;

  // Status
  status: BatchPlanStatus;

  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BatchPlanProgress = {
  plannedQuantity: number;
  batchCount: number;         // Number of batches created
  totalInBatches: number;     // Sum of batch quantities (not archived/dumped)
  totalCompleted: number;     // Sum of batches with status Ready/Shipped
  percentInBatches: number;   // (totalInBatches / plannedQuantity) * 100
  percentComplete: number;    // (totalCompleted / plannedQuantity) * 100
};

export type BatchPlanWithProgress = BatchPlan & {
  progress: BatchPlanProgress;
};

// ============================================================================
// API Payloads
// ============================================================================
export type CreateGuidePlanPayload = {
  name: string;
  description?: string | null;
  targetFamily: string;
  targetSizeId?: string | null;
  readyFromWeek: number;
  readyFromYear: number;
  readyToWeek: number;
  readyToYear: number;
  protocolId?: string | null;
  targetQuantity: number;
  status?: GuidePlanStatus;
};

export type UpdateGuidePlanPayload = Partial<CreateGuidePlanPayload>;

export type CreateBatchPlanPayload = {
  guidePlanId?: string | null;
  plantVarietyId: string;
  targetSizeId?: string | null;
  plannedQuantity: number;
  readyFromWeek?: number | null;
  readyFromYear?: number | null;
  readyToWeek?: number | null;
  readyToYear?: number | null;
  protocolId?: string | null;
  status?: BatchPlanStatus;
  notes?: string | null;
};

export type UpdateBatchPlanPayload = Partial<CreateBatchPlanPayload>;

export type CreateBatchesFromPlanPayload = {
  batchCount: number;
  // Optional: manual quantities per batch (if not provided, auto-distribute)
  quantities?: number[];
  // Optional: override location
  locationId?: string | null;
};

// ============================================================================
// Helper functions
// ============================================================================
export function formatWeekYear(week: number, year: number): string {
  return `W${week.toString().padStart(2, '0')} ${year}`;
}

export function formatWeekRange(
  fromWeek: number,
  fromYear: number,
  toWeek: number,
  toYear: number
): string {
  if (fromYear === toYear && fromWeek === toWeek) {
    return formatWeekYear(fromWeek, fromYear);
  }
  return `${formatWeekYear(fromWeek, fromYear)} – ${formatWeekYear(toWeek, toYear)}`;
}

export function calculateProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function buildGuidePlanProgress(
  targetQuantity: number,
  totalPlanned: number,
  totalInBatches: number,
  totalCompleted: number
): GuidePlanProgress {
  return {
    targetQuantity,
    totalPlanned,
    totalInBatches,
    totalCompleted,
    percentPlanned: calculateProgress(totalPlanned, targetQuantity),
    percentInBatches: calculateProgress(totalInBatches, targetQuantity),
    percentComplete: calculateProgress(totalCompleted, targetQuantity),
  };
}

export function buildBatchPlanProgress(
  plannedQuantity: number,
  batchCount: number,
  totalInBatches: number,
  totalCompleted: number
): BatchPlanProgress {
  return {
    plannedQuantity,
    batchCount,
    totalInBatches,
    totalCompleted,
    percentInBatches: calculateProgress(totalInBatches, plannedQuantity),
    percentComplete: calculateProgress(totalCompleted, plannedQuantity),
  };
}
