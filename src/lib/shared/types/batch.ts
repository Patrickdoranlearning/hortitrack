/**
 * Shared Batch Types
 *
 * Common batch-related types used by both main app and worker app.
 */

/**
 * Minimal batch representation used across apps
 */
export interface BatchSummary {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  sizeName: string | null;
  locationName: string | null;
  quantity: number;
  status: string | null;
  phase: string | null;
}

/**
 * Batch with parent/child relationship info
 */
export interface BatchWithLineage extends BatchSummary {
  parentBatchId: string | null;
  parentBatchNumber: string | null;
}

/**
 * Response type for batch creation operations
 */
export interface BatchCreateResult {
  id: string;
  batchNumber: string;
  quantity: number;
  phase: string;
  status: string;
}

/**
 * Response type for transplant operations
 */
export interface TransplantResult {
  childBatch: BatchCreateResult;
  parentNewQuantity: number;
}
