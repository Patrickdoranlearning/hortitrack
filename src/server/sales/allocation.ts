// src/server/sales/allocation.ts
import "server-only";
import type { Allocation } from "@/lib/sales/types";
import { getSaleableBatches, InventoryBatch } from "@/server/sales/inventory";
import { logger } from "@/server/utils/logger";

type DateLike = string | Date | { toDate: () => Date } | null | undefined;

function toTs(d: DateLike): number {
  try {
    if (!d) return 0;
    if (typeof d === "string") return new Date(d).getTime() || 0;
    if (d instanceof Date) return d.getTime() || 0;
    if (typeof d === "object" && "toDate" in d && typeof d.toDate === "function") {
      return d.toDate().getTime() || 0;
    }
    return 0;
  } catch { return 0; }
}

export interface AllocationOptions {
  plantVariety: string;
  size: string;
  qty: number;
  // Batch-specific options
  specificBatchId?: string; // Allocate from this exact batch
  gradePreference?: 'A' | 'B' | 'C'; // Prefer this grade
  preferredBatchNumbers?: string[]; // Try these batches first
}

/**
 * Enhanced allocation function with support for batch-specific preferences
 *
 * @param params - Allocation options (variety, size, qty, preferences)
 * @param cachedInventory - Optional pre-fetched inventory to avoid N+1 queries.
 *                          When processing multiple order lines, fetch inventory
 *                          once and pass it to all allocation calls.
 */
export async function allocateForProductLine(
  params: AllocationOptions,
  cachedInventory?: InventoryBatch[]
): Promise<Allocation[]> {
  const { plantVariety, size, qty, specificBatchId, gradePreference, preferredBatchNumbers } = params;

  // 1) Use cached inventory if provided, otherwise fetch (backward compatibility)
  const allSaleable = cachedInventory ?? await getSaleableBatches();

  let saleable = allSaleable
    .filter((b) =>
      b.plantVariety === plantVariety &&
      b.size === size &&
      (b.qcStatus !== "Rejected" && b.qcStatus !== "Quarantined") &&
      !b.hidden
    );

  // 2) If specific batch requested, only use that batch
  if (specificBatchId) {
    saleable = saleable.filter(b => b.id === specificBatchId);
    if (saleable.length === 0) {
      logger.sales.warn(`Specific batch not found or not available`, { specificBatchId });
      return [];
    }
  }

  // 3) FEFO sort: always apply FEFO within each group
  const fefoSort = (a: InventoryBatch, b: InventoryBatch) => {
    const ap = toTs(a.plantingDate);
    const bp = toTs(b.plantingDate);
    if (ap !== bp) return ap - bp;

    const ac = toTs(a.createdAt);
    const bc = toTs(b.createdAt);
    if (ac !== bc) return ac - bc;

    const ag = (a.grade || "Z");
    const bg = (b.grade || "Z");
    if (ag !== bg) return ag.localeCompare(bg);

    const an = String(a.batchNumber || "");
    const bn = String(b.batchNumber || "");
    return an.localeCompare(bn);
  };

  // 4) If grade preference specified, prioritize that grade (FEFO within each group)
  if (gradePreference && !specificBatchId) {
    const preferredGrade = saleable.filter(b => b.grade === gradePreference).sort(fefoSort);
    const otherGrades = saleable.filter(b => b.grade !== gradePreference).sort(fefoSort);
    saleable = [...preferredGrade, ...otherGrades];
  }

  // 5) If preferred batch numbers specified, prioritize those (FEFO within each group)
  if (preferredBatchNumbers && preferredBatchNumbers.length > 0 && !specificBatchId) {
    const preferred = saleable.filter(b =>
      b.batchNumber && preferredBatchNumbers.includes(b.batchNumber)
    ).sort(fefoSort);
    const others = saleable.filter(b =>
      !b.batchNumber || !preferredBatchNumbers.includes(b.batchNumber)
    ).sort(fefoSort);
    saleable = [...preferred, ...others];
  } else if (!gradePreference) {
    // Default: full FEFO sort when no preferences specified
    saleable = saleable.sort(fefoSort);
  }

  // 6) Split allocation across saleable batches until qty satisfied
  // Use availableQuantity (quantity - reserved) to avoid double-booking
  let remaining = qty;
  const out: Allocation[] = [];
  for (const b of saleable) {
    if (remaining <= 0) break;
    // Use availableQuantity which accounts for reserved stock
    const availableQty = b.availableQuantity ?? (b.quantity || 0);
    const take = Math.min(availableQty, remaining);
    if (take > 0) {
      out.push({
        batchId: b.id,
        batchNumber: b.batchNumber,
        qty: take,
        grade: b.grade,
        location: b.location,
      });
      remaining -= take;
    }
  }

  // Warn if we couldn't fulfill the full quantity
  if (remaining > 0) {
    logger.sales.warn("Could not fully allocate requested quantity", {
      requestedQty: qty,
      plantVariety,
      size,
      shortfall: remaining,
      allocated: qty - remaining,
    });
  }

  return out;
}
