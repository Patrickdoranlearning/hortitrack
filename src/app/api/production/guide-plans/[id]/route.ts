import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { buildGuidePlanProgress } from "@/lib/planning/guide-plan-types";
import type { GuidePlanWithProgress } from "@/lib/planning/guide-plan-types";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateGuidePlanSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(1000).optional().nullable(),
  targetFamily: z.string().min(1).optional(),
  targetSizeId: z.string().uuid().optional().nullable(),
  readyFromWeek: z.number().int().min(1).max(53).optional(),
  readyFromYear: z.number().int().min(2020).optional(),
  readyToWeek: z.number().int().min(1).max(53).optional(),
  readyToYear: z.number().int().min(2020).optional(),
  protocolId: z.string().uuid().optional().nullable(),
  targetQuantity: z.number().int().positive().optional(),
  status: z.enum(["draft", "active", "completed", "cancelled"]).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET - Get a single guide plan with progress and batch plans
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const admin = getSupabaseAdmin();

    // Fetch guide plan with related data
    const { data: gp, error } = await admin
      .from("guide_plans")
      .select(`
        id,
        org_id,
        name,
        description,
        target_family,
        target_size_id,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year,
        protocol_id,
        target_quantity,
        status,
        created_at,
        updated_at,
        plant_sizes(name),
        protocols(name)
      `)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error || !gp) {
      logger.production.error("Guide plan not found", error);
      return NextResponse.json({ error: "Guide plan not found" }, { status: 404 });
    }

    // Fetch batch plans for this guide plan
    const { data: batchPlans } = await admin
      .from("batch_plans")
      .select(`
        id,
        guide_plan_id,
        plant_variety_id,
        target_size_id,
        planned_quantity,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year,
        protocol_id,
        status,
        notes,
        created_at,
        updated_at,
        plant_varieties(name, family),
        plant_sizes(name),
        protocols(name)
      `)
      .eq("guide_plan_id", id)
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    // Fetch batches linked to these batch plans
    const batchPlanIds = (batchPlans ?? []).map(bp => bp.id);
    const { data: batches } = batchPlanIds.length > 0
      ? await admin
          .from("batches")
          .select("id, batch_plan_id, quantity, status")
          .in("batch_plan_id", batchPlanIds)
      : { data: [] };

    // Calculate progress
    const totalPlanned = (batchPlans ?? []).reduce((sum, bp) => sum + (bp.planned_quantity || 0), 0);
    const activeBatches = (batches ?? []).filter(b => !["Archived", "Dumped"].includes(b.status ?? ""));
    const totalInBatches = activeBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const totalCompleted = (batches ?? [])
      .filter(b => ["Ready", "Shipped"].includes(b.status ?? ""))
      .reduce((sum, b) => sum + (b.quantity || 0), 0);

    // Transform batch plans with progress
    const transformedBatchPlans = (batchPlans ?? []).map((bp: any) => {
      const bpBatches = (batches ?? []).filter(b => b.batch_plan_id === bp.id);
      const bpActiveBatches = bpBatches.filter(b => !["Archived", "Dumped"].includes(b.status ?? ""));
      const bpTotalInBatches = bpActiveBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const bpTotalCompleted = bpBatches
        .filter(b => ["Ready", "Shipped"].includes(b.status ?? ""))
        .reduce((sum, b) => sum + (b.quantity || 0), 0);

      return {
        id: bp.id,
        orgId: bp.org_id,
        guidePlanId: bp.guide_plan_id,
        plantVarietyId: bp.plant_variety_id,
        plantVarietyName: bp.plant_varieties?.name ?? null,
        plantVarietyFamily: bp.plant_varieties?.family ?? null,
        targetSizeId: bp.target_size_id,
        targetSizeName: bp.plant_sizes?.name ?? null,
        plannedQuantity: bp.planned_quantity,
        readyFromWeek: bp.ready_from_week,
        readyFromYear: bp.ready_from_year,
        readyToWeek: bp.ready_to_week,
        readyToYear: bp.ready_to_year,
        protocolId: bp.protocol_id,
        protocolName: bp.protocols?.name ?? null,
        status: bp.status,
        notes: bp.notes,
        createdAt: bp.created_at,
        updatedAt: bp.updated_at,
        progress: {
          plannedQuantity: bp.planned_quantity,
          batchCount: bpBatches.length,
          totalInBatches: bpTotalInBatches,
          totalCompleted: bpTotalCompleted,
          percentInBatches: bp.planned_quantity > 0
            ? Math.min(100, Math.round((bpTotalInBatches / bp.planned_quantity) * 100))
            : 0,
          percentComplete: bp.planned_quantity > 0
            ? Math.min(100, Math.round((bpTotalCompleted / bp.planned_quantity) * 100))
            : 0,
        },
      };
    });

    const guidePlan: GuidePlanWithProgress = {
      id: gp.id,
      orgId: gp.org_id,
      name: gp.name,
      description: gp.description,
      targetFamily: gp.target_family,
      targetSizeId: gp.target_size_id,
      targetSizeName: (gp as any).plant_sizes?.name ?? null,
      readyFromWeek: gp.ready_from_week,
      readyFromYear: gp.ready_from_year,
      readyToWeek: gp.ready_to_week,
      readyToYear: gp.ready_to_year,
      protocolId: gp.protocol_id,
      protocolName: (gp as any).protocols?.name ?? null,
      targetQuantity: gp.target_quantity,
      status: gp.status as any,
      createdAt: gp.created_at,
      updatedAt: gp.updated_at,
      progress: buildGuidePlanProgress(
        gp.target_quantity,
        totalPlanned,
        totalInBatches,
        totalCompleted
      ),
      batchPlanCount: (batchPlans ?? []).length,
    };

    return NextResponse.json({ guidePlan, batchPlans: transformedBatchPlans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load guide plan";
    logger.production.error("Guide plan GET failed", error);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// PATCH - Update a guide plan
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const payload = UpdateGuidePlanSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify user has org membership
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to update guide plans in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Build update object with snake_case keys
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.targetFamily !== undefined) updates.target_family = payload.targetFamily;
    if (payload.targetSizeId !== undefined) updates.target_size_id = payload.targetSizeId;
    if (payload.readyFromWeek !== undefined) updates.ready_from_week = payload.readyFromWeek;
    if (payload.readyFromYear !== undefined) updates.ready_from_year = payload.readyFromYear;
    if (payload.readyToWeek !== undefined) updates.ready_to_week = payload.readyToWeek;
    if (payload.readyToYear !== undefined) updates.ready_to_year = payload.readyToYear;
    if (payload.protocolId !== undefined) updates.protocol_id = payload.protocolId;
    if (payload.targetQuantity !== undefined) updates.target_quantity = payload.targetQuantity;
    if (payload.status !== undefined) updates.status = payload.status;

    const { data, error } = await admin
      .from("guide_plans")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
      .select(`
        id,
        org_id,
        name,
        description,
        target_family,
        target_size_id,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year,
        protocol_id,
        target_quantity,
        status,
        created_at,
        updated_at,
        plant_sizes(name),
        protocols(name)
      `)
      .single();

    if (error || !data) {
      logger.production.error("Guide plan update failed", error);
      if (error?.code === "PGRST116") {
        return NextResponse.json({ error: "Guide plan not found" }, { status: 404 });
      }
      throw new Error(error?.message ?? "Failed to update guide plan");
    }

    const guidePlan = {
      id: data.id,
      orgId: data.org_id,
      name: data.name,
      description: data.description,
      targetFamily: data.target_family,
      targetSizeId: data.target_size_id,
      targetSizeName: (data as any).plant_sizes?.name ?? null,
      readyFromWeek: data.ready_from_week,
      readyFromYear: data.ready_from_year,
      readyToWeek: data.ready_to_week,
      readyToYear: data.ready_to_year,
      protocolId: data.protocol_id,
      protocolName: (data as any).protocols?.name ?? null,
      targetQuantity: data.target_quantity,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ guidePlan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update guide plan";
    logger.production.error("Guide plan PATCH failed", error);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE - Delete a guide plan
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { supabase, orgId, user } = await getUserAndOrg();

    // Verify user has org membership
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have permission to delete guide plans in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from("guide_plans")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      logger.production.error("Guide plan delete failed", error);
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete guide plan";
    logger.production.error("Guide plan DELETE failed", error);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
