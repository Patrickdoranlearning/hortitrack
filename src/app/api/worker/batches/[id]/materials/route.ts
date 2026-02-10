import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { getPlannedBatchMaterials } from "@/server/materials/consumption";
import { getBatchMaterialLots } from "@/server/materials/lots";
import type { PlannedBatchMaterial } from "@/server/materials/consumption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Worker Batch Materials API
 *
 * Returns planned + consumed materials for a batch, along with a merged
 * checklist showing the status of each planned material.
 */

type ConsumedItem = {
  materialId: string;
  materialName: string;
  partNumber: string;
  lotNumber: string;
  quantityConsumed: number;
  uom: string;
  consumedAt: string;
  consumedBy: string | null;
};

type ChecklistItem = {
  materialId: string;
  materialName: string;
  partNumber: string;
  baseUom: string;
  quantityPlanned: number;
  quantityConsumed: number;
  status: "pending" | "confirmed" | "partial";
};

type BatchMaterialsResponse = {
  planned: PlannedBatchMaterial[];
  consumed: ConsumedItem[];
  checklist: ChecklistItem[];
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    // Fetch planned and consumed materials in parallel
    const [planned, consumedLots] = await Promise.all([
      getPlannedBatchMaterials(supabase, orgId, id),
      getBatchMaterialLots(supabase, orgId, id),
    ]);

    // Map consumed lots to a flat response shape
    const consumed: ConsumedItem[] = consumedLots.map((lot) => ({
      materialId: lot.materialId,
      materialName: lot.material?.name ?? "Unknown",
      partNumber: lot.material?.partNumber ?? "",
      lotNumber: lot.lot?.lotNumber ?? "N/A",
      quantityConsumed: lot.quantityConsumed,
      uom: lot.uom,
      consumedAt: lot.consumedAt,
      consumedBy: lot.consumedBy ?? null,
    }));

    // Aggregate total consumed per material for the checklist
    const consumedByMaterial = new Map<string, number>();
    for (const item of consumed) {
      const existing = consumedByMaterial.get(item.materialId) ?? 0;
      consumedByMaterial.set(item.materialId, existing + item.quantityConsumed);
    }

    // Build checklist merging planned + consumed
    const checklist: ChecklistItem[] = planned.map((p) => {
      const totalConsumed = consumedByMaterial.get(p.materialId) ?? 0;

      let status: ChecklistItem["status"];
      if (totalConsumed >= p.quantityPlanned) {
        status = "confirmed";
      } else if (totalConsumed > 0) {
        status = "partial";
      } else {
        status = "pending";
      }

      return {
        materialId: p.materialId,
        materialName: p.materialName,
        partNumber: p.materialPartNumber,
        baseUom: p.baseUom,
        quantityPlanned: p.quantityPlanned,
        quantityConsumed: totalConsumed,
        status,
      };
    });

    const response: BatchMaterialsResponse = {
      planned,
      consumed,
      checklist,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.worker.error("Batch materials fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load batch materials" },
      { status: 500 }
    );
  }
}
