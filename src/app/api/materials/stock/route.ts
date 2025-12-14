import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { getStockSummary } from "@/server/materials/stock";

export const runtime = "nodejs";

/**
 * GET /api/materials/stock
 * Get stock summary across all materials
 */
export async function GET() {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const summary = await getStockSummary(supabase, orgId);

    return NextResponse.json({ stock: summary });
  } catch (error: unknown) {
    console.error("[materials/stock GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stock summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
