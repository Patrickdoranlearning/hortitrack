import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { submitPurchaseOrder } from "@/server/materials/purchase-orders";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/materials/purchase-orders/[id]/submit
 * Submit a draft purchase order
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const order = await submitPurchaseOrder(supabase, orgId, id);

    return NextResponse.json({ order });
  } catch (error: unknown) {
    logger.materials.error("Purchase order submit failed", error);
    const message = error instanceof Error ? error.message : "Failed to submit purchase order";
    const status = message.includes("only submit draft") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
