import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getAvailableLotsFifo } from "@/server/materials/lots";
import { FifoLotsQuerySchema } from "@/lib/schemas/material-lots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/materials/lots/fifo
 * Get available lots for a material in FIFO order
 * Returns lots ordered by received date (oldest first) with suggested lots marked
 */
export async function GET(req: Request) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { searchParams } = new URL(req.url);

    const params = FifoLotsQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!params.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: params.error.format() },
        { status: 400 }
      );
    }

    const result = await getAvailableLotsFifo(
      supabase,
      orgId,
      params.data.materialId,
      params.data.requiredQuantity,
      params.data.locationId
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[lots/fifo GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to get FIFO lots";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
