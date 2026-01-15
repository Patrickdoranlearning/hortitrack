import type { Batch } from "./types";

export interface BatchDistribution {
  available: number;
  allocated: number;
  sold: number;
  dumped: number;
  transplanted: number;
  totalAccounted: number;
}

export function calculateBatchDistribution(batch: Batch | null | undefined): BatchDistribution {
  if (!batch) {
    return { available: 0, allocated: 0, sold: 0, dumped: 0, transplanted: 0, totalAccounted: 0 };
  }

  // 1. Quantities already removed from the batch (based on logs)
  let transplanted_removed = 0;
  let dumped_removed = 0;
  let sold_removed = 0;

  const logs = (batch as any).logHistory || [];
  logs.forEach((log: any) => {
    const type = log.type?.toUpperCase();
    const qty = Math.abs(log.qty || log.quantity || 0);

    if (type === 'TRANSPLANT_TO' || type === 'TRANSPLANT_OUT') {
      transplanted_removed += qty;
    } else if (type === 'LOSS' || type === 'DUMP') {
      dumped_removed += qty;
    } else if (type === 'PICKED' || type === 'SALE' || type === 'DISPATCH') {
      sold_removed += qty;
    }
  });

  // 2. Physical units currently on hand
  const currentQuantity = batch.quantity || (batch as any).quantity || 0;
  const allocated = batch.reservedQuantity || (batch as any).reserved_quantity || 0;
  const saleableQuantity = (batch as any).saleableQuantity ?? (batch as any).saleable_quantity ?? null;
  
  // Of the units on hand, how are they distributed?
  let available = Math.max(0, currentQuantity - allocated);
  let sold_on_hand = 0;

  // If saleable_quantity is set, it overrides what's considered "available"
  if (saleableQuantity !== null) {
    const actualSaleable = Math.min(available, saleableQuantity);
    // Any physical units that are NOT saleable and NOT allocated are considered "sold on hand" (e.g. picked but not shipped)
    sold_on_hand = Math.max(0, available - actualSaleable);
    available = actualSaleable;
  }

  // 3. Reconcile with initial quantity
  // total tracked = current on hand + units known to be removed
  const totalTracked = currentQuantity + transplanted_removed + dumped_removed + sold_removed;
  const initial = batch.initialQuantity || (batch as any).initial_quantity || totalTracked;
  
  // LOG HISTORY RECONCILIATION
  // If we have explicit logs for things being removed, we trust them first.
  
  let sold_discrepancy = 0;
  let dumped_discrepancy = 0;

  // If we have fewer units than we started with, and don't know why (missing logs), 
  // and the quantity has decreased from initial, attribute the difference.
  if (initial > totalTracked) {
    const missing = initial - totalTracked;
    const status = (batch.status || '').toUpperCase();
    const salesStatus = (batch.salesStatus || (batch as any).sales_status || '').toLowerCase();
    
    // In these statuses, missing units are likely sales. In others, they're likely losses.
    const isSaleableStatus = 
      ['READY FOR SALE', 'LOOKING GOOD', 'POTTED', 'AVAILABLE', 'ROOTED & READY'].includes(status) ||
      salesStatus === 'available';
    
    // CRITICAL: We only attribute to "Sold" discrepancy if there's evidence of sales activity 
    // OR if the discrepancy is specifically identified as sold stock by the user.
    // Given the "Sold" requirement, we'll keep the logic but refine it.
    if (isSaleableStatus) {
      sold_discrepancy = missing;
    } else {
      dumped_discrepancy = missing;
    }
  }

  return {
    available,
    allocated,
    sold: sold_removed + sold_on_hand + sold_discrepancy,
    dumped: dumped_removed + dumped_discrepancy,
    transplanted: transplanted_removed,
    totalAccounted: Math.max(initial, totalTracked)
  };
}
