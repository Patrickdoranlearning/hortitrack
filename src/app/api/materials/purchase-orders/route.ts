import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";
import { listPurchaseOrders, createPurchaseOrder } from "@/server/materials/purchase-orders";
import { CreatePurchaseOrderSchema, PurchaseOrdersQuerySchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";

/**
 * GET /api/materials/purchase-orders
 * List purchase orders with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const searchParams = req.nextUrl.searchParams;
    const query = PurchaseOrdersQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      supplierId: searchParams.get("supplierId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: query.error.flatten() },
        { status: 400 }
      );
    }

    const result = await listPurchaseOrders(supabase, orgId, query.data);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[purchase-orders GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch purchase orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/materials/purchase-orders
 * Create a new purchase order
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const body = await req.json();

    const parsed = CreatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerApp();
    const order = await createPurchaseOrder(supabase, orgId, userId, parsed.data);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error: unknown) {
    console.error("[purchase-orders POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create purchase order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
