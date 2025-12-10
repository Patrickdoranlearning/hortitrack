import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductionProtocolRouteSchema, ProductionProtocolStepSchema, ProductionTargetsSchema } from "@/lib/protocol-types";
import { getUserAndOrg } from "@/server/auth/org";
import { rowToProtocolSummary, type ProtocolRow } from "@/server/planning/service";

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
  { params }: { params: { protocolId: string } }
) {
  try {
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
      .eq("id", params.protocolId)
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
      return NextResponse.json(
        { error: error?.message ?? "Protocol not found" },
        { status: error?.code === "PGRST116" ? 404 : 500 }
      );
    }

    const protocol = rowToProtocolSummary(data as ProtocolRow);
    return NextResponse.json({ protocol });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error?.message ?? "Failed to update protocol";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { protocolId: string } }
) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { error } = await supabase
      .from("protocols")
      .delete()
      .eq("id", params.protocolId)
      .eq("org_id", orgId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.message ?? "Failed to delete protocol";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}



