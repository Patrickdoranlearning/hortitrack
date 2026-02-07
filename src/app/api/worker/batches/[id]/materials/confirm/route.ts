import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { consumeFromLot } from "@/server/materials/lots";

const ConfirmMaterialSchema = z.object({
  lotId: z.string().uuid(),
  materialId: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();
    const { id: batchId } = await params;

    const body = await req.json();
    const input = ConfirmMaterialSchema.parse(body);

    // Verify batch exists and belongs to org
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id")
      .eq("id", batchId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Call the existing consumeFromLot function
    const result = await consumeFromLot(supabase, orgId, user.id, {
      lotId: input.lotId,
      quantity: input.quantity,
      batchId,
      notes: input.notes ?? `Material confirmation for batch`,
    });

    return NextResponse.json({
      success: true,
      consumed: result.consumed,
      lotNumber: result.lot.lotNumber,
      remainingInLot: result.lot.currentQuantity,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", issues: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to confirm material";

    // Handle specific error cases
    if (message.includes("Insufficient quantity")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (/unauth/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
