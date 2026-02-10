import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { getMaterial } from "@/server/materials/service";
import { getStockByMaterial } from "@/server/materials/stock";
import { listMaterialLots } from "@/server/materials/lots";
import type { WorkerMaterialDetail } from "@/types/worker";

/**
 * Worker Material Detail API
 *
 * Returns material info with stock breakdown by location
 * and available lots for lot-tracked materials.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, orgId } = await getUserAndOrg();

    // Get material details
    const material = await getMaterial(supabase, orgId, id);

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    // Get stock by location
    const stockRecords = await getStockByMaterial(supabase, orgId, id);

    // Get lots (available only)
    const { lots } = await listMaterialLots(supabase, orgId, {
      filters: {
        materialId: id,
        hasStock: true,
      },
      sortField: "receivedAt",
      sortOrder: "asc",
      limit: 50,
    });

    // Calculate total stock
    const totalStock = stockRecords.reduce((sum, s) => sum + s.quantityOnHand, 0);
    const reorderPoint = material.reorderPoint ?? null;
    const isLowStock = reorderPoint !== null && totalStock < reorderPoint;

    // Transform stock by location
    const stockByLocation: WorkerMaterialDetail["stockByLocation"] = stockRecords.map((s) => ({
      locationId: s.locationId ?? null,
      locationName: s.location?.name ?? "General Stock",
      onHand: s.quantityOnHand,
      reserved: s.quantityReserved,
      available: s.quantityAvailable,
    }));

    // If no stock records, add a general stock entry with 0
    if (stockByLocation.length === 0) {
      stockByLocation.push({
        locationId: null,
        locationName: "General Stock",
        onHand: 0,
        reserved: 0,
        available: 0,
      });
    }

    // Transform lots
    const lotsData: WorkerMaterialDetail["lots"] = lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      quantity: lot.currentQuantity,
      expiryDate: lot.expiryDate ?? null,
      locationName: lot.location?.name ?? null,
      supplierLotNumber: lot.supplierLotNumber ?? null,
      status: lot.status,
    }));

    const response: WorkerMaterialDetail = {
      id: material.id,
      partNumber: material.partNumber,
      name: material.name,
      description: material.description ?? null,
      categoryName: material.category?.name ?? "Unknown",
      categoryCode: material.category?.code ?? "OTH",
      uom: material.baseUom,
      totalStock,
      reorderPoint,
      isLowStock,
      stockByLocation,
      lots: lotsData,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.worker.error("Worker material detail fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching material details" },
      { status: 500 }
    );
  }
}
