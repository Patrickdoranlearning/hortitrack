import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { transferStock } from "@/server/materials/stock";
import { StockTransferSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";

/**
 * POST /api/materials/stock/transfer
 * Transfer stock between locations
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const body = await req.json();

    const parsed = StockTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { materialId, fromLocationId, toLocationId, quantity, notes } = parsed.data;
    const supabase = await getSupabaseServerApp();

    const transaction = await transferStock(
      supabase,
      orgId,
      userId,
      materialId,
      fromLocationId ?? null,
      toLocationId,
      quantity,
      notes
    );

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error: unknown) {
    console.error("[materials/stock/transfer POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to transfer stock";
    const status = message.includes("Insufficient") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
