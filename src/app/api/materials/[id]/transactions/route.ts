import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { getTransactions } from "@/server/materials/stock";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/materials/[id]/transactions
 * Get transaction history for a specific material
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: materialId } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const searchParams = req.nextUrl.searchParams;
    const transactionType = searchParams.get("type") ?? undefined;
    const fromDate = searchParams.get("from") ?? undefined;
    const toDate = searchParams.get("to") ?? undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined;

    const result = await getTransactions(supabase, orgId, {
      materialId,
      transactionType,
      fromDate,
      toDate,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[materials/[id]/transactions GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
