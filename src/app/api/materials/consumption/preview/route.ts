import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import { previewConsumption } from "@/server/materials/consumption";

export const runtime = "nodejs";

/**
 * GET /api/materials/consumption/preview
 * Preview material consumption for a batch actualization
 * Query params: sizeId, quantity
 */
export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const sizeId = req.nextUrl.searchParams.get("sizeId");
    const quantityStr = req.nextUrl.searchParams.get("quantity");

    if (!sizeId) {
      return NextResponse.json({ error: "sizeId is required" }, { status: 400 });
    }

    const quantity = parseInt(quantityStr ?? "0");
    if (quantity <= 0) {
      return NextResponse.json({ error: "quantity must be positive" }, { status: 400 });
    }

    const preview = await previewConsumption(supabase, orgId, sizeId, quantity);

    return NextResponse.json({ preview });
  } catch (error: unknown) {
    logger.materials.error("Consumption preview failed", error);
    const message = error instanceof Error ? error.message : "Failed to preview consumption";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
