import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { buildBatchPlanProgress } from "@/lib/planning/guide-plan-types";
import type { BatchPlanWithProgress } from "@/lib/planning/guide-plan-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateBatchPlanSchema = z.object({
  guidePlanId: z.string().uuid().optional().nullable(),
  plantVarietyId: z.string().uuid().optional(),
  targetSizeId: z.string().uuid().optional().nullable(),
  plannedQuantity: z.number().int().positive().optional(),
  readyFromWeek: z.number().int().min(1).max(53).optional().nullable(),
  readyFromYear: z.number().int().min(2020).optional().nullable(),
  readyToWeek: z.number().int().min(1).max(53).optional().nullable(),
  readyToYear: z.number().int().min(2020).optional().nullable(),
  protocolId: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "active", "completed"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

type RouteParams = { params: Promise<{ id: string }> };

// GET - Get a single batch plan with progress
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { orgId } = await getUserAndOrg();
    const admin = getSupabaseAdmin();

    const { data: bp, error } = await admin
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
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error || !bp) {
      console.error("[batch-plans/[id] GET] not found:", error);
      return NextResponse.json({ error: "Batch plan not found" }, { status: 404 });
    }

    // Fetch batches linked to this batch plan
    const { data: batches } = await admin
      .from("batches")
      .select("id, batch_plan_id, quantity, status, batch_number")
      .eq("batch_plan_id", id);

    const bpBatches = batches ?? [];
    const bpActiveBatches = bpBatches.filter(b => !["Archived", "Dumped"].includes(b.status ?? ""));
    const bpTotalInBatches = bpActiveBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const bpTotalCompleted = bpBatches
      .filter(b => ["Ready", "Shipped"].includes(b.status ?? ""))
      .reduce((sum, b) => sum + (b.quantity || 0), 0);

    const batchPlan: BatchPlanWithProgress = {
      id: bp.id,
      orgId: bp.org_id,
      guidePlanId: bp.guide_plan_id,
      plantVarietyId: bp.plant_variety_id,
      plantVarietyName: (bp as any).plant_varieties?.name ?? null,
      plantVarietyFamily: (bp as any).plant_varieties?.family ?? null,
      targetSizeId: bp.target_size_id,
      targetSizeName: (bp as any).plant_sizes?.name ?? null,
      plannedQuantity: bp.planned_quantity,
      readyFromWeek: bp.ready_from_week,
      readyFromYear: bp.ready_from_year,
      readyToWeek: bp.ready_to_week,
      readyToYear: bp.ready_to_year,
      protocolId: bp.protocol_id,
      protocolName: (bp as any).protocols?.name ?? null,
      status: bp.status as any,
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

    return NextResponse.json({ batchPlan, batches: bpBatches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load batch plan";
    console.error("[batch-plans/[id] GET] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// PATCH - Update a batch plan
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const payload = UpdateBatchPlanSchema.parse(await req.json());
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
        { error: "You don't have permission to update batch plans in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Build update object with snake_case keys
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.guidePlanId !== undefined) updates.guide_plan_id = payload.guidePlanId;
    if (payload.plantVarietyId !== undefined) updates.plant_variety_id = payload.plantVarietyId;
    if (payload.targetSizeId !== undefined) updates.target_size_id = payload.targetSizeId;
    if (payload.plannedQuantity !== undefined) updates.planned_quantity = payload.plannedQuantity;
    if (payload.readyFromWeek !== undefined) updates.ready_from_week = payload.readyFromWeek;
    if (payload.readyFromYear !== undefined) updates.ready_from_year = payload.readyFromYear;
    if (payload.readyToWeek !== undefined) updates.ready_to_week = payload.readyToWeek;
    if (payload.readyToYear !== undefined) updates.ready_to_year = payload.readyToYear;
    if (payload.protocolId !== undefined) updates.protocol_id = payload.protocolId;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.notes !== undefined) updates.notes = payload.notes;

    const { data, error } = await admin
      .from("batch_plans")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
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
      console.error("[batch-plans/[id] PATCH] update failed:", error);
      if (error?.code === "PGRST116") {
        return NextResponse.json({ error: "Batch plan not found" }, { status: 404 });
      }
      throw new Error(error?.message ?? "Failed to update batch plan");
    }

    const batchPlan = {
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
      status: data.status,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return NextResponse.json({ batchPlan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update batch plan";
    console.error("[batch-plans/[id] PATCH] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE - Delete a batch plan
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
        { error: "You don't have permission to delete batch plans in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from("batch_plans")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      console.error("[batch-plans/[id] DELETE] failed:", error);
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete batch plan";
    console.error("[batch-plans/[id] DELETE] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
