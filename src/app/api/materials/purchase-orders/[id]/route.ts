import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
} from "@/server/materials/purchase-orders";
import { UpdatePurchaseOrderSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/materials/purchase-orders/[id]
 * Get a single purchase order with lines
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const order = await getPurchaseOrder(supabase, orgId, id);
    if (!order) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error: unknown) {
    console.error("[purchase-orders/[id] GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch purchase order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/materials/purchase-orders/[id]
 * Update a purchase order (draft only)
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const body = await req.json();

    const parsed = UpdatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerApp();
    const order = await updatePurchaseOrder(supabase, orgId, id, parsed.data);

    return NextResponse.json({ order });
  } catch (error: unknown) {
    console.error("[purchase-orders/[id] PUT] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to update purchase order";
    const status = message.includes("only edit draft") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/materials/purchase-orders/[id]
 * Cancel a purchase order
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const order = await cancelPurchaseOrder(supabase, orgId, id);

    return NextResponse.json({ order });
  } catch (error: unknown) {
    console.error("[purchase-orders/[id] DELETE] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to cancel purchase order";
    const status = message.includes("Cannot cancel") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
