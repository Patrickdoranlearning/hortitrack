import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { receiveGoods } from "@/server/materials/purchase-orders";
import { ReceiveGoodsSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/materials/purchase-orders/[id]/receive
 * Receive goods against a purchase order
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { userId, orgId } = await getUserAndOrg();
    const body = await req.json();

    const parsed = ReceiveGoodsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerApp();
    const order = await receiveGoods(supabase, orgId, userId, id, parsed.data);

    return NextResponse.json({ order });
  } catch (error: unknown) {
    console.error("[purchase-orders/[id]/receive POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to receive goods";
    const status = message.includes("Cannot receive") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
