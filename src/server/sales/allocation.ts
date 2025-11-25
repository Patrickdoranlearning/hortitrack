// src/server/sales/allocation.ts
import "server-only";
import type { Allocation } from "@/lib/sales/types";
import { getSaleableBatches, InventoryBatch } from "@/server/sales/inventory";

function toTs(d: any): number {
  try {
    if (!d) return 0;
    if (typeof d === "string") return new Date(d).getTime() || 0;
    if (typeof d?.toDate === "function") return d.toDate().getTime() || 0;
    return new Date(d).getTime() || 0;
  } catch { return 0; }
}

// ...

export async function allocateForProductLine(params: {
  plantVariety: string;
  size: string;
  qty: number;
}): Promise<Allocation[]> {
  const { plantVariety, size, qty } = params;

  // 1) Get all saleable batches and filter by variety/size
  const allSaleable = await getSaleableBatches();

  const saleable = allSaleable
    .filter((b) =>
      b.plantVariety === plantVariety &&
      b.size === size &&
      (b.qcStatus !== "Rejected" && b.qcStatus !== "Quarantined") &&
      !b.hidden
    )
    .sort((a, b) => {
      // Prefer older plantingDate (FEFO-like), then createdAt; then grade; then batchNumber
      const ap = toTs(a.plantingDate);
      const bp = toTs(b.plantingDate);
      if (ap !== bp) return ap - bp;

      const ac = toTs(a.createdAt);
      const bc = toTs(b.createdAt);
      if (ac !== bc) return ac - bc;

      // Grade A before B before C (descending)
      const ag = (a.grade || "Z");
      const bg = (b.grade || "Z");
      if (ag !== bg) return ag.localeCompare(bg);

      const an = String(a.batchNumber || "");
      const bn = String(b.batchNumber || "");
      return an.localeCompare(bn);
    });

  // 2) Split allocation across saleable batches until qty satisfied
  let remaining = qty;
  const out: Allocation[] = [];
  for (const b of saleable) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity || 0, remaining);
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
  return out;
}
