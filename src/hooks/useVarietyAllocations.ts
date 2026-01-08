import { useState, useCallback, useMemo } from 'react';
import type {
  CustomerCatalogProductWithVarieties,
  CartItem,
  VarietyAllocation,
  BatchAllocation,
} from '@/lib/b2b/types';

type AllocationMode = 'generic' | 'variety' | 'batch';

interface UseVarietyAllocationsProps {
  product: CustomerCatalogProductWithVarieties;
  initialMode?: AllocationMode;
}

interface UseVarietyAllocationsReturn {
  // Mode management
  mode: AllocationMode;
  setMode: (mode: AllocationMode) => void;

  // Generic mode state
  genericQuantity: number;
  setGenericQuantity: (qty: number) => void;

  // Variety mode state
  varietyAllocations: Map<string, VarietyAllocation>;
  updateVarietyQuantity: (varietyId: string, qty: number) => void;
  updateVarietyBatches: (varietyId: string, batches: BatchAllocation[]) => void;

  // Computed values
  totalQuantity: number;
  isValid: boolean;

  // Convert to CartItem(s)
  toCartItems: (
    rrp?: number,
    multibuyPrice2?: number,
    multibuyQty2?: number
  ) => CartItem[];

  // Reset
  reset: () => void;
}

/**
 * Custom hook for managing variety allocations in accordion component
 * Handles three modes: generic, variety, and batch selection
 */
export function useVarietyAllocations({
  product,
  initialMode = 'generic',
}: UseVarietyAllocationsProps): UseVarietyAllocationsReturn {
  const [mode, setMode] = useState<AllocationMode>(initialMode);
  const [genericQuantity, setGenericQuantityState] = useState(0);
  const [varietyAllocations, setVarietyAllocations] = useState<
    Map<string, VarietyAllocation>
  >(new Map());

  /**
   * Handle generic quantity change
   * Clears variety allocations when switching to generic mode
   */
  const setGenericQuantity = useCallback((qty: number) => {
    setGenericQuantityState(qty);
    if (qty > 0) {
      setMode('generic');
      setVarietyAllocations(new Map());
    } else if (qty === 0) {
      // Reset mode if quantity is cleared
      setMode('generic');
    }
  }, []);

  /**
   * Update quantity for a specific variety
   * Switches to variety mode and clears generic quantity
   */
  const updateVarietyQuantity = useCallback(
    (varietyId: string, qty: number) => {
      setVarietyAllocations((prev) => {
        const next = new Map(prev);
        if (qty === 0) {
          next.delete(varietyId);
        } else {
          const variety = product.varieties.find(
            (v) => v.varietyId === varietyId
          );
          next.set(varietyId, {
            varietyId,
            varietyName: variety?.varietyName || '',
            quantity: qty,
            batchAllocations: prev.get(varietyId)?.batchAllocations,
            hasBatchSelection: prev.get(varietyId)?.hasBatchSelection || false,
          });
        }
        return next;
      });

      // Clear generic quantity and switch mode
      setGenericQuantityState(0);
      setMode('variety');
    },
    [product.varieties]
  );

  /**
   * Update batch allocations for a specific variety
   * Switches to batch mode and updates quantity from batch total
   */
  const updateVarietyBatches = useCallback(
    (varietyId: string, batches: BatchAllocation[]) => {
      setVarietyAllocations((prev) => {
        const next = new Map(prev);

        // Calculate total quantity from batch allocations
        const totalQty = batches.reduce((sum, b) => sum + b.qty, 0);

        if (totalQty === 0 || batches.length === 0) {
          next.delete(varietyId);
        } else {
          const variety = product.varieties.find(
            (v) => v.varietyId === varietyId
          );
          next.set(varietyId, {
            varietyId,
            varietyName: variety?.varietyName || '',
            quantity: totalQty,
            batchAllocations: batches,
            hasBatchSelection: true,
          });
        }
        return next;
      });

      setGenericQuantityState(0);
      setMode('batch');
    },
    [product.varieties]
  );

  /**
   * Calculate total quantity across all allocations
   */
  const totalQuantity = useMemo(() => {
    if (mode === 'generic') return genericQuantity;
    return Array.from(varietyAllocations.values()).reduce(
      (sum, v) => sum + v.quantity,
      0
    );
  }, [mode, genericQuantity, varietyAllocations]);

  /**
   * Check if allocation is valid (at least one item)
   */
  const isValid = useMemo(() => totalQuantity > 0, [totalQuantity]);

  /**
   * Convert allocations to CartItem array
   * Generic mode: Single cart item with no constraints
   * Variety/Batch mode: Separate cart item per variety
   */
  const toCartItems = useCallback(
    (rrp?: number, multibuyPrice2?: number, multibuyQty2?: number): CartItem[] => {
      // Generic mode: single cart item with no variety/batch constraints
      if (mode === 'generic') {
        return [
          {
            productId: product.productId,
            skuId: product.skuId,
            productName: product.aliasName || product.productName,
            varietyName: product.varietyName,
            sizeName: product.sizeName,
            sizeId: product.sizeId ?? undefined,
            family: product.family ?? undefined,
            quantity: genericQuantity,
            unitPriceExVat: product.unitPriceExVat!,
            vatRate: product.vatRate,
            rrp,
            multibuyPrice2,
            multibuyQty2,
            // No variety/batch constraints for generic orders
          },
        ];
      }

      // Variety/Batch mode: create separate cart item per variety
      const cartItems: CartItem[] = [];
      varietyAllocations.forEach((allocation) => {
        cartItems.push({
          productId: product.productId,
          skuId: product.skuId,
          productName: product.aliasName || product.productName,
          varietyName: allocation.varietyName,
          sizeName: product.sizeName,
          sizeId: product.sizeId ?? undefined,
          family: product.family ?? undefined,
          quantity: allocation.quantity,
          unitPriceExVat: product.unitPriceExVat!,
          vatRate: product.vatRate,
          requiredVarietyId: allocation.varietyId,
          requiredVarietyName: allocation.varietyName,
          batchAllocations: allocation.batchAllocations,
          rrp,
          multibuyPrice2,
          multibuyQty2,
        });
      });

      return cartItems;
    },
    [mode, genericQuantity, varietyAllocations, product]
  );

  /**
   * Reset all allocations
   */
  const reset = useCallback(() => {
    setMode('generic');
    setGenericQuantityState(0);
    setVarietyAllocations(new Map());
  }, []);

  return {
    mode,
    setMode,
    genericQuantity,
    setGenericQuantity,
    varietyAllocations,
    updateVarietyQuantity,
    updateVarietyBatches,
    totalQuantity,
    isValid,
    toCartItems,
    reset,
  };
}
