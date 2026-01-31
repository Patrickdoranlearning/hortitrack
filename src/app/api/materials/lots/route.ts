import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { listMaterialLots, receiveMaterialLots } from "@/server/materials/lots";
import { MaterialLotsQuerySchema, ReceiveMaterialLotsSchema } from "@/lib/schemas/material-lots";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/materials/lots
 * List material lots with optional filters
 */
export async function GET(req: Request) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { searchParams } = new URL(req.url);

    const params = MaterialLotsQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!params.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: params.error.format() },
        { status: 400 }
      );
    }

    // Convert status string to array if needed
    let statusFilter = params.data.status;
    if (typeof statusFilter === "string") {
      statusFilter = [statusFilter];
    }

    const { lots, total } = await listMaterialLots(supabase, orgId, {
      filters: {
        materialId: params.data.materialId,
        locationId: params.data.locationId,
        status: statusFilter,
        supplierId: params.data.supplierId,
        hasStock: params.data.hasStock === "true" ? true : params.data.hasStock === "false" ? false : undefined,
        expiringWithinDays: params.data.expiringWithinDays,
        search: params.data.search,
      },
      sortField: params.data.sortField,
      sortOrder: params.data.sortOrder,
      limit: params.data.limit,
      offset: params.data.offset,
    });

    return NextResponse.json({
      lots,
      total,
      limit: params.data.limit,
      offset: params.data.offset,
    });
  } catch (error: unknown) {
    console.error("[lots GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch lots";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/materials/lots
 * Receive new material lots (ad-hoc receipt without PO)
 */
export async function POST(req: Request) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();

    // Rate limit: 50 lots per minute per user
    const rlKey = `lots:receive:${requestKey(req, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 50 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", resetMs: rl.resetMs }, { status: 429 });
    }

    const body = await req.json();

    const parsed = ReceiveMaterialLotsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const lots = await receiveMaterialLots(
      supabase,
      orgId,
      user.id,
      parsed.data.materialId,
      parsed.data.lots,
      parsed.data.locationId,
      parsed.data.notes ?? undefined
    );

    return NextResponse.json({ lots }, { status: 201 });
  } catch (error: unknown) {
    console.error("[lots POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to receive lots";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
