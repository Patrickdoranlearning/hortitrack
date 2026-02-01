import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getStockSummary } from "@/server/materials/stock";

/**
 * Worker Materials API
 *
 * Mobile-optimized endpoint for listing materials with stock levels.
 * Supports category filtering and search.
 */

const QuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  stockStatus: z.enum(["all", "low", "out"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type WorkerMaterial = {
  id: string;
  partNumber: string;
  name: string;
  categoryName: string;
  uom: string;
  totalOnHand: number;
  totalAvailable: number;
  reorderPoint: number | null;
  isLowStock: boolean;
  isOutOfStock: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parse = QuerySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parse.error.flatten() },
        { status: 400 }
      );
    }

    const { q, category, stockStatus, page, pageSize } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    // Get full stock summary
    const stockItems = await getStockSummary(supabase, orgId);

    // Apply filters
    let filtered = stockItems;

    // Search filter
    if (q && q.length > 0) {
      const searchLower = q.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.materialName.toLowerCase().includes(searchLower) ||
          item.partNumber.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (category && category !== "all") {
      filtered = filtered.filter((item) => item.categoryName === category);
    }

    // Stock status filter
    if (stockStatus === "low") {
      filtered = filtered.filter((item) => item.isLowStock);
    } else if (stockStatus === "out") {
      filtered = filtered.filter((item) => item.totalOnHand <= 0);
    }

    // Sort by category then name
    filtered.sort((a, b) => {
      const catCompare = a.categoryName.localeCompare(b.categoryName);
      if (catCompare !== 0) return catCompare;
      return a.materialName.localeCompare(b.materialName);
    });

    // Paginate
    const total = filtered.length;
    const from = (page - 1) * pageSize;
    const paginated = filtered.slice(from, from + pageSize);

    // Transform for response
    const items: WorkerMaterial[] = paginated.map((item) => ({
      id: item.materialId,
      partNumber: item.partNumber,
      name: item.materialName,
      categoryName: item.categoryName,
      uom: item.baseUom,
      totalOnHand: item.totalOnHand,
      totalAvailable: item.totalAvailable,
      reorderPoint: item.reorderPoint,
      isLowStock: item.isLowStock,
      isOutOfStock: item.totalOnHand <= 0,
    }));

    // Get unique categories for filter options
    const categories = [...new Set(stockItems.map((i) => i.categoryName))].sort();

    // Low stock count for badge
    const lowStockCount = stockItems.filter((i) => i.isLowStock).length;

    return NextResponse.json({
      page,
      pageSize,
      total,
      lowStockCount,
      categories,
      items,
    });
  } catch (error) {
    console.error("[api/worker/materials] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching materials" },
      { status: 500 }
    );
  }
}
