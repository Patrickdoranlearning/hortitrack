import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import {
  addPurchaseOrderLine,
  removePurchaseOrderLine,
} from "@/server/materials/purchase-orders";
import { PurchaseOrderLineInputSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/materials/purchase-orders/[id]/lines
 * Add a line to a draft purchase order
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const body = await req.json();

    const parsed = PurchaseOrderLineInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerApp();
    const order = await addPurchaseOrderLine(supabase, orgId, id, parsed.data);

    return NextResponse.json({ order });
  } catch (error: unknown) {
    logger.materials.error("Purchase order add line failed", error);
    const message = error instanceof Error ? error.message : "Failed to add line";
    const status = message.includes("only add lines") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/materials/purchase-orders/[id]/lines
 * Remove a line from a draft purchase order
 * Query param: lineId
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();

    const lineId = req.nextUrl.searchParams.get("lineId");
    if (!lineId) {
      return NextResponse.json({ error: "lineId query parameter is required" }, { status: 400 });
    }

    const supabase = await getSupabaseServerApp();
    const order = await removePurchaseOrderLine(supabase, orgId, id, lineId);

    return NextResponse.json({ order });
  } catch (error: unknown) {
    logger.materials.error("Purchase order remove line failed", error);
    const message = error instanceof Error ? error.message : "Failed to remove line";
    const status = message.includes("only remove lines") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
