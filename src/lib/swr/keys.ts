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

  // Consumption preview pattern (dynamic)
  consumptionPreview: (sizeId: string, quantity: number) =>
    `/api/materials/consumption/preview?sizeId=${sizeId}&quantity=${quantity}`,
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
  mutate((key) => typeof key === 'string' && key.startsWith('/api/production/batches'), undefined, { revalidate: true });
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
