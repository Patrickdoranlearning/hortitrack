import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/materials/stats
 * Get materials dashboard statistics
 */
export async function GET() {
  try {
    const { supabase, orgId } = await getUserAndOrg();

    // Run all queries in parallel for better performance
    const [materialsResult, lowStockResult, openPOsResult, stockValueResult] = await Promise.all([
      // Total active materials count
      supabase
        .from("materials")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("is_active", true),

      // Low stock items (below reorder point)
      supabase
        .from("material_stock")
        .select(`
          material_id,
          quantity_on_hand,
          materials!inner (
            id,
            reorder_point,
            is_active
          )
        `)
        .eq("org_id", orgId),

      // Open purchase orders count
      supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .in("status", ["draft", "submitted", "confirmed", "partially_received"]),

      // Total stock value (quantity * standard_cost)
      supabase
        .from("material_stock")
        .select(`
          quantity_on_hand,
          materials!inner (
            id,
            standard_cost,
            is_active
          )
        `)
        .eq("org_id", orgId),
    ]);

    // Handle any errors
    if (materialsResult.error) {
      logError("Failed to fetch materials count", { error: materialsResult.error.message });
    }
    if (lowStockResult.error) {
      logError("Failed to fetch low stock items", { error: lowStockResult.error.message });
    }
    if (openPOsResult.error) {
      logError("Failed to fetch open POs", { error: openPOsResult.error.message });
    }
    if (stockValueResult.error) {
      logError("Failed to fetch stock value", { error: stockValueResult.error.message });
    }

    // Calculate low stock count
    let lowStockCount = 0;
    const stockByMaterial = new Map<string, number>();

    for (const row of lowStockResult.data ?? []) {
      const material = row.materials as { id: string; reorder_point: number | null; is_active: boolean } | null;
      if (!material?.is_active) continue;

      const existing = stockByMaterial.get(row.material_id) ?? 0;
      stockByMaterial.set(row.material_id, existing + Number(row.quantity_on_hand || 0));
    }

    // Check which materials are below reorder point
    for (const row of lowStockResult.data ?? []) {
      const material = row.materials as { id: string; reorder_point: number | null; is_active: boolean } | null;
      if (!material?.is_active || material.reorder_point === null) continue;

      const totalStock = stockByMaterial.get(row.material_id) ?? 0;
      if (totalStock < material.reorder_point) {
        lowStockCount++;
        // Remove from map so we don't count the same material twice
        stockByMaterial.delete(row.material_id);
      }
    }

    // Calculate total stock value
    let totalStockValue = 0;
    for (const row of stockValueResult.data ?? []) {
      const material = row.materials as { id: string; standard_cost: number | null; is_active: boolean } | null;
      if (!material?.is_active || !material.standard_cost) continue;

      const quantity = Number(row.quantity_on_hand || 0);
      totalStockValue += quantity * material.standard_cost;
    }

    return NextResponse.json({
      totalMaterials: materialsResult.count ?? 0,
      lowStockCount,
      openPOsCount: openPOsResult.count ?? 0,
      totalStockValue: Math.round(totalStockValue * 100) / 100, // Round to 2 decimal places
    });
  } catch (error: unknown) {
    logError("Materials stats error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch materials stats";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
