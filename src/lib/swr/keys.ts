/**
 * Centralized SWR cache keys and mutation utilities
 *
 * Use these keys consistently across the app to ensure proper cache invalidation.
 * Call the invalidate functions after mutations to refresh data across all components.
 */

import { mutate } from 'swr';

// =============================================================================
// Cache Keys
// =============================================================================

export const SWR_KEYS = {
  // Reference data (varieties, sizes, locations, suppliers)
  REFERENCE_DATA: 'reference-data',

  // Materials
  MATERIALS: '/api/materials',
  MATERIAL_CATEGORIES: '/api/materials/categories',
  MATERIAL_STOCK: '/api/materials/stock',

  // Production batches
  BATCHES: '/api/production/batches',
  PLANNED_BATCHES: '/api/production/batches/planned',

  // Guide Plans & Batch Plans
  GUIDE_PLANS: '/api/production/guide-plans',
  guidePlan: (id: string) => `/api/production/guide-plans/${id}`,
  BATCH_PLANS: '/api/production/batch-plans',
  batchPlansForGuide: (guidePlanId: string) =>
    `/api/production/batch-plans?guide_plan_id=${guidePlanId}`,
  batchPlan: (id: string) => `/api/production/batch-plans/${id}`,

  // Consumption preview pattern (dynamic)
  consumptionPreview: (sizeId: string, quantity: number) =>
    `/api/materials/consumption/preview?sizeId=${sizeId}&quantity=${quantity}`,

  // Trolley balances
  TROLLEY_BALANCES: '/api/dispatch/trolleys/balances',
  trolleyBalance: (customerId: string) =>
    `/api/dispatch/trolleys/balances?customerId=${customerId}`,
  TROLLEY_TRANSACTIONS: '/api/dispatch/trolleys/transactions',
  trolleyHistory: (customerId: string) =>
    `/api/dispatch/trolleys/transactions?customerId=${customerId}`,
  trolleyReconciliation: (orderId: string) =>
    `/api/dispatch/trolley-reconciliation?orderId=${orderId}`,
} as const;

// =============================================================================
// Invalidation Functions
// =============================================================================

/**
 * Invalidate reference data cache (varieties, sizes, locations, suppliers)
 * Call this after creating/updating/deleting any reference data
 */
export function invalidateReferenceData() {
  return mutate(SWR_KEYS.REFERENCE_DATA);
}

/**
 * Invalidate all materials-related caches
 * Call this after creating/updating/deleting materials or adjusting stock
 */
export function invalidateMaterials() {
  // Invalidate materials list
  mutate((key) => typeof key === 'string' && key.startsWith('/api/materials'), undefined, { revalidate: true });
}

/**
 * Invalidate material consumption previews
 * Call this after stock adjustments or material linking changes
 */
export function invalidateConsumptionPreviews() {
  mutate(
    (key) => typeof key === 'string' && key.includes('/api/materials/consumption/preview'),
    undefined,
    { revalidate: true }
  );
}

/**
 * Invalidate all production batch caches
 * Call this after creating/updating batches
 */
export function invalidateBatches() {
  // Invalidate API-based batch queries
  mutate((key) => typeof key === 'string' && key.startsWith('/api/production/batches'), undefined, { revalidate: true });
  // Also invalidate server action-based batch queries (used by BatchesClient)
  mutate('batches', undefined, { revalidate: true });
  // Invalidate /api/batches endpoints
  mutate((key) => typeof key === 'string' && key.startsWith('/api/batches'), undefined, { revalidate: true });
}

/**
 * Invalidate everything - use sparingly
 * Call this after major operations that affect multiple data types
 */
export function invalidateAll() {
  invalidateReferenceData();
  invalidateMaterials();
  invalidateBatches();
}

// =============================================================================
// Typed Mutation Helpers
// =============================================================================

/**
 * After creating a variety, size, location, or supplier
 */
export function onReferenceDataChange() {
  invalidateReferenceData();
}

/**
 * After material stock changes (receive, consume, adjust, transfer)
 */
export function onMaterialStockChange() {
  invalidateMaterials();
  invalidateConsumptionPreviews();
}

/**
 * After batch operations (create, transplant, actualize, etc.)
 */
export function onBatchChange() {
  invalidateBatches();
  invalidateConsumptionPreviews(); // Stock may have changed due to consumption
}

/**
 * Invalidate guide plans and batch plans caches
 * Call this after creating/updating/deleting guide plans or batch plans
 */
export function invalidateGuidePlans() {
  mutate((key) => typeof key === 'string' && key.startsWith('/api/production/guide-plans'), undefined, { revalidate: true });
}

export function invalidateBatchPlans() {
  mutate((key) => typeof key === 'string' && key.startsWith('/api/production/batch-plans'), undefined, { revalidate: true });
}

/**
 * After guide plan or batch plan changes
 */
export function onGuidePlanChange() {
  invalidateGuidePlans();
  invalidateBatchPlans();
}

export function onBatchPlanChange() {
  invalidateBatchPlans();
  invalidateGuidePlans(); // Guide plan progress may have changed
}

/**
 * Invalidate trolley balance caches
 * Call this after recording trolley movements or completing deliveries
 */
export function invalidateTrolleyBalances() {
  mutate(
    (key) => typeof key === 'string' && key.startsWith('/api/dispatch/trolleys'),
    undefined,
    { revalidate: true }
  );
}

/**
 * Invalidate trolley reconciliation caches
 */
export function invalidateTrolleyReconciliation() {
  mutate(
    (key) => typeof key === 'string' && key.startsWith('/api/dispatch/trolley-reconciliation'),
    undefined,
    { revalidate: true }
  );
}

/**
 * After trolley movements (deliveries, returns, adjustments)
 */
export function onTrolleyMovement() {
  invalidateTrolleyBalances();
  invalidateTrolleyReconciliation();
}
