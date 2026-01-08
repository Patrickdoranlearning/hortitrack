'use client';

/**
 * Client-side hooks for mutating reference data with automatic cache invalidation
 *
 * These hooks wrap server actions and automatically invalidate the SWR cache
 * after successful mutations, ensuring data stays in sync across all components.
 */

import { useCallback } from 'react';
import { invalidateReferenceData, invalidateMaterials, invalidateConsumptionPreviews } from './keys';
import type { NurseryLocation, PlantSize, Supplier, Variety } from '@/lib/types';
import {
  addLocationAction,
  updateLocationAction,
  deleteLocationAction,
  addSizeAction,
  updateSizeAction,
  deleteSizeAction,
  addSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
  addVarietyAction,
  updateVarietyAction,
  deleteVarietyAction,
} from '@/app/actions';

type ActionResult<T> = { success: true; data?: T } | { success: false; error: string };

/**
 * Hook for location mutations with automatic cache invalidation
 */
export function useLocationMutations() {
  const add = useCallback(async (data: Omit<NurseryLocation, 'id'>) => {
    const result = await addLocationAction(data);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<NurseryLocation>;
  }, []);

  const update = useCallback(async (data: NurseryLocation) => {
    const result = await updateLocationAction(data);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<NurseryLocation>;
  }, []);

  const remove = useCallback(async (id: string) => {
    const result = await deleteLocationAction(id);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<void>;
  }, []);

  return { add, update, remove };
}

/**
 * Hook for size mutations with automatic cache invalidation
 */
export function useSizeMutations() {
  const add = useCallback(async (data: Omit<PlantSize, 'id'>) => {
    const result = await addSizeAction(data);
    if (result.success) {
      invalidateReferenceData();
      // Sizes affect material consumption previews
      invalidateConsumptionPreviews();
    }
    return result as ActionResult<PlantSize>;
  }, []);

  const update = useCallback(async (data: PlantSize) => {
    const result = await updateSizeAction(data);
    if (result.success) {
      invalidateReferenceData();
      invalidateConsumptionPreviews();
    }
    return result as ActionResult<PlantSize>;
  }, []);

  const remove = useCallback(async (id: string) => {
    const result = await deleteSizeAction(id);
    if (result.success) {
      invalidateReferenceData();
      invalidateConsumptionPreviews();
    }
    return result as ActionResult<void>;
  }, []);

  return { add, update, remove };
}

/**
 * Hook for supplier mutations with automatic cache invalidation
 */
export function useSupplierMutations() {
  const add = useCallback(async (data: Omit<Supplier, 'id'>) => {
    const result = await addSupplierAction(data);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<Supplier>;
  }, []);

  const update = useCallback(async (data: Supplier) => {
    const result = await updateSupplierAction(data);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<Supplier>;
  }, []);

  const remove = useCallback(async (id: string) => {
    const result = await deleteSupplierAction(id);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<void>;
  }, []);

  return { add, update, remove };
}

/**
 * Hook for variety mutations with automatic cache invalidation
 */
export function useVarietyMutations() {
  const add = useCallback(async (data: Omit<Variety, 'id'>) => {
    const result = await addVarietyAction(data);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<Variety>;
  }, []);

  const update = useCallback(async (data: Variety) => {
    const result = await updateVarietyAction(data);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<Variety>;
  }, []);

  const remove = useCallback(async (id: string) => {
    const result = await deleteVarietyAction(id);
    if (result.success) {
      invalidateReferenceData();
    }
    return result as ActionResult<void>;
  }, []);

  return { add, update, remove };
}

/**
 * Convenience hook that provides all reference data mutation functions
 */
export function useReferenceDataMutations() {
  const locations = useLocationMutations();
  const sizes = useSizeMutations();
  const suppliers = useSupplierMutations();
  const varieties = useVarietyMutations();

  return {
    locations,
    sizes,
    suppliers,
    varieties,
    // Also export the raw invalidation functions for manual use
    invalidateReferenceData,
    invalidateMaterials,
    invalidateConsumptionPreviews,
  };
}
