import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { buildBatchPlanProgress } from "@/lib/planning/guide-plan-types";
import type { BatchPlanWithProgress } from "@/lib/planning/guide-plan-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBatchPlanSchema = z.object({
  guidePlanId: z.string().uuid().optional().nullable(),
  plantVarietyId: z.string().uuid(),
  targetSizeId: z.string().uuid().optional().nullable(),
  plannedQuantity: z.number().int().positive("Quantity must be positive"),
  readyFromWeek: z.number().int().min(1).max(53).optional().nullable(),
  readyFromYear: z.number().int().min(2020).optional().nullable(),
  readyToWeek: z.number().int().min(1).max(53).optional().nullable(),
  readyToYear: z.number().int().min(2020).optional().nullable(),
  protocolId: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "active", "completed"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

// GET - List batch plans (optionally filtered by guide_plan_id)
export async function GET(req: Request) {
  try {
    const { orgId } = await getUserAndOrg();
    const admin = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const guidePlanId = searchParams.get("guide_plan_id");

    // Build query
    let query = admin
      .from("batch_plans")
      .select(`
        id,
        org_id,
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
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (guidePlanId) {
      query = query.eq("guide_plan_id", guidePlanId);
    }

    const { data: batchPlans, error } = await query;

    if (error) {
      console.error("[batch-plans GET] query failed:", error);
      throw new Error(error.message);
    }

    // Fetch batches linked to batch plans for progress
    const batchPlanIds = (batchPlans ?? []).map(bp => bp.id);
    const { data: batches } = batchPlanIds.length > 0
      ? await admin
          .from("batches")
          .select("id, batch_plan_id, quantity, status")
          .in("batch_plan_id", batchPlanIds)
      : { data: [] };

    // Build progress for each batch plan
    const result: BatchPlanWithProgress[] = (batchPlans ?? []).map((bp: any) => {
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
        progress: buildBatchPlanProgress(
          bp.planned_quantity,
          bpBatches.length,
          bpTotalInBatches,
          bpTotalCompleted
        ),
      };
    });

    return NextResponse.json({ batchPlans: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load batch plans";
    console.error("[batch-plans GET] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST - Create a new batch plan
export async function POST(req: Request) {
  try {
    const payload = CreateBatchPlanSchema.parse(await req.json());
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
        { error: "You don't have permission to create batch plans in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // If guide_plan_id is provided, verify it exists and belongs to org
    if (payload.guidePlanId) {
      const { data: guidePlan } = await admin
        .from("guide_plans")
        .select("id")
        .eq("id", payload.guidePlanId)
        .eq("org_id", orgId)
        .single();

      if (!guidePlan) {
        return NextResponse.json(
          { error: "Guide plan not found" },
          { status: 404 }
        );
      }
    }

    const { data, error } = await admin
      .from("batch_plans")
      .insert({
        org_id: orgId,
        guide_plan_id: payload.guidePlanId ?? null,
        plant_variety_id: payload.plantVarietyId,
        target_size_id: payload.targetSizeId ?? null,
        planned_quantity: payload.plannedQuantity,
        ready_from_week: payload.readyFromWeek ?? null,
        ready_from_year: payload.readyFromYear ?? null,
        ready_to_week: payload.readyToWeek ?? null,
        ready_to_year: payload.readyToYear ?? null,
        protocol_id: payload.protocolId ?? null,
        status: payload.status ?? "draft",
        notes: payload.notes ?? null,
      })
      .select(`
        id,
        org_id,
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
      .single();

    if (error || !data) {
      console.error("[batch-plans POST] insert failed:", error);
      throw new Error(error?.message ?? "Failed to create batch plan");
    }

    const batchPlan: BatchPlanWithProgress = {
      id: data.id,
      orgId: data.org_id,
      guidePlanId: data.guide_plan_id,
      plantVarietyId: data.plant_variety_id,
      plantVarietyName: (data as any).plant_varieties?.name ?? null,
      plantVarietyFamily: (data as any).plant_varieties?.family ?? null,
      targetSizeId: data.target_size_id,
      targetSizeName: (data as any).plant_sizes?.name ?? null,
      plannedQuantity: data.planned_quantity,
      readyFromWeek: data.ready_from_week,
      readyFromYear: data.ready_from_year,
      readyToWeek: data.ready_to_week,
      readyToYear: data.ready_to_year,
      protocolId: data.protocol_id,
      protocolName: (data as any).protocols?.name ?? null,
      status: data.status as any,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      progress: buildBatchPlanProgress(data.planned_quantity, 0, 0, 0),
    };

    return NextResponse.json({ batchPlan }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create batch plan";
    console.error("[batch-plans POST] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
