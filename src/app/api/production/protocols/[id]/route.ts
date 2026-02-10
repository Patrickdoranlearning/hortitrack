import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductionProtocolRouteSchema, ProductionProtocolStepSchema, ProductionTargetsSchema } from "@/lib/protocol-types";
import { getUserAndOrg } from "@/server/auth/org";
import { rowToProtocolSummary, type ProtocolRow } from "@/server/planning/service";
import { logger } from "@/server/utils/logger";

const ProtocolUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(1000).optional(),
  targetVarietyId: z.string().uuid().optional(),
  targetSizeId: z.string().uuid().optional(),
  summary: z.string().nullable().optional(),
  steps: z.array(ProductionProtocolStepSchema).optional(),
  targets: ProductionTargetsSchema.optional(),
  route: ProductionProtocolRouteSchema.optional(),
  isActive: z.boolean().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: protocolId } = await params;
    const payload = ProtocolUpdateSchema.parse(await req.json());
    const { supabase, orgId } = await getUserAndOrg();

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.targetVarietyId !== undefined) updates.target_variety_id = payload.targetVarietyId;
    if (payload.targetSizeId !== undefined) updates.target_size_id = payload.targetSizeId;
    if (payload.route !== undefined) updates.route = payload.route;
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;

    const hasDefinitionUpdates =
      Object.prototype.hasOwnProperty.call(payload, "summary") ||
      Object.prototype.hasOwnProperty.call(payload, "steps") ||
      Object.prototype.hasOwnProperty.call(payload, "targets");

    if (hasDefinitionUpdates) {
      updates.definition = {
        summary: payload.summary ?? null,
        steps: payload.steps ?? [],
        targets: payload.targets ?? null,
      };
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No updates supplied" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("protocols")
      .update(updates)
      .eq("id", protocolId)
      .eq("org_id", orgId)
      .select(
        [
          "id",
          "org_id",
          "name",
          "description",
          "target_variety_id",
          "target_size_id",
          "is_active",
          "definition",
          "route",
          "created_at",
          "updated_at",
          "plant_varieties(name)",
          "plant_sizes(name)",
        ].join(",")
      )
      .single();

    if (error || !data) {
      logger.production.error("Protocol update failed", error);
      return NextResponse.json(
        { error: error?.code === "PGRST116" ? "Protocol not found" : "Failed to update protocol" },
        { status: error?.code === "PGRST116" ? 404 : 500 }
      );
    }

    const protocol = rowToProtocolSummary(data as ProtocolRow);
    return NextResponse.json({ protocol });
  } catch (error) {
    logger.production.error("Protocol PATCH exception", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", issues: (error as z.ZodError).issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to update protocol" }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: protocolId } = await params;
    const { supabase, orgId } = await getUserAndOrg();
    const { error } = await supabase
      .from("protocols")
      .delete()
      .eq("id", protocolId)
      .eq("org_id", orgId);

    if (error) {
      logger.production.error("Protocol delete failed", error);
      return NextResponse.json({ error: "Failed to delete protocol" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.production.error("Protocol DELETE exception", error);
    const message = error instanceof Error ? error.message : "";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Failed to delete protocol" }, { status });
  }
}




