import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { requireRole } from "@/server/auth/getUser";
import { logger } from "@/server/utils/logger";
import { getMaterial, updateMaterial, deleteMaterial } from "@/server/materials/service";
import { UpdateMaterialSchema } from "@/lib/schemas/materials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/materials/[id]
 * Get a single material by ID
 */
export async function GET(req: Request, context: RouteContext) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { id } = await context.params;

    const material = await getMaterial(supabase, orgId, id);

    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    return NextResponse.json({ material });
  } catch (error: unknown) {
    logger.materials.error("Material GET failed", error);
    const message = error instanceof Error ? error.message : "Failed to fetch material";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PUT /api/materials/[id]
 * Update a material
 */
export async function PUT(req: Request, context: RouteContext) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { id } = await context.params;
    const body = await req.json();

    const parsed = UpdateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    // Check material exists
    const existing = await getMaterial(supabase, orgId, id);
    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const material = await updateMaterial(supabase, orgId, id, parsed.data);

    return NextResponse.json({ material });
  } catch (error: unknown) {
    logger.materials.error("Material update failed", error);
    const message = error instanceof Error ? error.message : "Failed to update material";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/materials/[id]
 * Soft delete a material (sets is_active = false)
 * Requires admin or owner role
 */
export async function DELETE(req: Request, context: RouteContext) {
  try {
    // Check role first - only admins and owners can delete materials
    const roleCheck = await requireRole(['owner', 'admin']);
    if (!roleCheck.authorized) {
      return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });
    }

    const { supabase, orgId } = await getUserAndOrg();
    const { id } = await context.params;

    // Check material exists
    const existing = await getMaterial(supabase, orgId, id);
    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    await deleteMaterial(supabase, orgId, id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.materials.error("Material delete failed", error);
    const message = error instanceof Error ? error.message : "Failed to delete material";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
