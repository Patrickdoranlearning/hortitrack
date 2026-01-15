import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { listMaterials, createMaterial } from "@/server/materials/service";
import { MaterialsQuerySchema, CreateMaterialSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/materials
 * List materials with optional filters
 */
export async function GET(req: Request) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { searchParams } = new URL(req.url);

    const params = MaterialsQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!params.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: params.error.format() },
        { status: 400 }
      );
    }

    const { materials, total } = await listMaterials(supabase, orgId, {
      categoryId: params.data.categoryId,
      categoryCode: params.data.categoryCode,
      linkedSizeId: params.data.linkedSizeId,
      supplierId: params.data.supplierId,
      isActive: params.data.isActive === "true" ? true : params.data.isActive === "false" ? false : undefined,
      search: params.data.search,
      limit: params.data.limit,
      offset: params.data.offset,
    });

    return NextResponse.json({
      materials,
      total,
      limit: params.data.limit,
      offset: params.data.offset,
    });
  } catch (error: unknown) {
    console.error("[materials GET] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch materials";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/materials
 * Create a new material
 */
export async function POST(req: Request) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();
    const body = await req.json();

    const parsed = CreateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const material = await createMaterial(supabase, orgId, parsed.data, user.id);

    return NextResponse.json({ material }, { status: 201 });
  } catch (error: unknown) {
    console.error("[materials POST] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create material";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
