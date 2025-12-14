import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { getStockByMaterial } from "@/server/materials/stock";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/materials/[id]/stock
 * Get stock levels for a specific material across all locations
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: materialId } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const stock = await getStockByMaterial(supabase, orgId, materialId);

    return NextResponse.json({ stock });
  } catch (error: unknown) {
    console.error("[materials/[id]/stock GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
