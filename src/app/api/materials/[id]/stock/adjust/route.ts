import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { adjustStock, recordCount } from "@/server/materials/stock";
import { StockAdjustmentSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/materials/[id]/stock/adjust
 * Adjust stock for a material (manual adjustment or physical count)
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: materialId } = await params;
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const body = await req.json();

    const parsed = StockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { locationId, quantity, reason, notes, isCount } = parsed.data;
    const supabase = await getSupabaseServerApp();

    let transaction;

    if (isCount) {
      // Physical count - quantity is the counted value, not the adjustment
      transaction = await recordCount(
        supabase,
        orgId,
        userId,
        materialId,
        locationId ?? null,
        quantity,
        notes
      );
    } else {
      // Manual adjustment - quantity is the change (+/-)
      transaction = await adjustStock(
        supabase,
        orgId,
        userId,
        materialId,
        locationId ?? null,
        quantity,
        reason ?? "Manual adjustment",
        notes
      );
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error: unknown) {
    console.error("[materials/[id]/stock/adjust POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to adjust stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
