import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transplantBatch, TransplantInput } from "@/server/batches/service";
import { getUserIdAndOrgId } from "@/server/auth/getUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  plantingDate: z.string().datetime(),
  quantity: z.number().int().positive(),
  size: z.string().min(1),
  locationId: z.string().optional().nullable(), // Allow null for locationId
  location: z.string().optional().nullable(),   // Allow null for location name
  logRemainingAsLoss: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
});

function corsHeaders() {
  const allow =
    process.env.NODE_ENV === "development" ? "*" : undefined;
  return {
    "access-control-allow-origin": allow ?? "",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,idempotency-key",
    "access-control-allow-credentials": "true",
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { userId } = await getUserIdAndOrgId();
    if (!userId) {
       return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map(i => ({
            path: i.path.join("."),
            message: i.message,
            code: i.code,
          })),
        },
        { status: 400, headers: corsHeaders() }
      );
    }
    const input = parsed.data;

    const transplantInput: TransplantInput = {
        plantingDate: input.plantingDate,
        quantity: input.quantity,
        sizeId: input.size,
        locationId: input.locationId,
        locationName: input.location,
        logRemainingAsLoss: input.logRemainingAsLoss,
        notes: input.notes,
    };

    const result = await transplantBatch(params.batchId, transplantInput, userId);

    return NextResponse.json(
      { ok: true, newBatch: result },
      { status: 201, headers: corsHeaders() }
    );
  } catch (e: any) {
    const msg = e?.message ?? "unknown error";
    const status = /not found/.test(msg)
      ? 404
      : /exceeds/.test(msg)
      ? 400
      : 500;
    console.error("Error in transplant route:", e);
    return NextResponse.json(
      { error: msg },
      { status, headers: corsHeaders() }
    );
  }
}
