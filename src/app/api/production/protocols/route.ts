import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductionProtocolRouteSchema, ProductionProtocolStepSchema, ProductionTargetsSchema } from "@/lib/protocol-types";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { listProtocols, rowToProtocolSummary, type ProtocolRow } from "@/server/planning/service";
import { logger } from "@/server/utils/logger";

const ProtocolPayloadSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(1000).optional(),
  targetVarietyId: z.string().uuid().nullable(),
  targetSizeId: z.string().uuid().optional(),
  summary: z.string().optional(),
  steps: z.array(ProductionProtocolStepSchema).default([]),
  targets: ProductionTargetsSchema.optional(),
  route: ProductionProtocolRouteSchema,
  isActive: z.boolean().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const protocols = await listProtocols();
    return NextResponse.json({ protocols });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load protocols";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const payload = ProtocolPayloadSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify user has org membership (for authorization)
    const { data: membership, error: membershipError } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (membershipError) {
      logger.production.error("Protocol POST membership check failed", membershipError);
    }

    if (!membership) {
      logger.production.warn("User has no membership for org", { userId: user.id, orgId });
      return NextResponse.json(
        { error: "You don't have permission to create protocols in this organization" },
        { status: 403 }
      );
    }

    const definition = {
      summary: payload.summary ?? null,
      steps: payload.steps ?? [],
      targets: payload.targets ?? null,
    };

    // Use admin client to bypass RLS for insert (user is already authorized via membership check)
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("protocols")
      .insert({
        org_id: orgId,
        name: payload.name,
        description: payload.description ?? null,
        target_variety_id: payload.targetVarietyId,
        target_size_id: payload.targetSizeId ?? null,
        definition,
        route: payload.route,
        is_active: payload.isActive ?? true,
      })
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
      logger.production.error("Protocol insert failed", error);
      throw new Error(error?.message ?? "Failed to create protocol");
    }

    const protocol = rowToProtocolSummary(data as ProtocolRow);
    return NextResponse.json({ protocol }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create protocol";
    logger.production.error("Protocol POST failed", error);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}







