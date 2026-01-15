import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { buildGuidePlanProgress } from "@/lib/planning/guide-plan-types";
import type { GuidePlanWithProgress } from "@/lib/planning/guide-plan-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateGuidePlanSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().max(1000).optional().nullable(),
  targetFamily: z.string().min(1, "Target family is required"),
  targetSizeId: z.string().uuid().optional().nullable(),
  readyFromWeek: z.number().int().min(1).max(53),
  readyFromYear: z.number().int().min(2020),
  readyToWeek: z.number().int().min(1).max(53),
  readyToYear: z.number().int().min(2020),
  protocolId: z.string().uuid().optional().nullable(),
  targetQuantity: z.number().int().positive("Quantity must be positive"),
  status: z.enum(["draft", "active", "completed", "cancelled"]).optional(),
});

// GET - List all guide plans with progress
export async function GET() {
  try {
    const { orgId } = await getUserAndOrg();
    const admin = getSupabaseAdmin();

    // Fetch guide plans with related data
    const { data: guidePlans, error } = await admin
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
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[guide-plans GET] query failed:", error);
      throw new Error(error.message);
    }

    // Fetch batch plans for progress calculation
    const { data: batchPlans } = await admin
      .from("batch_plans")
      .select(`
        id,
        guide_plan_id,
        planned_quantity
      `)
      .eq("org_id", orgId);

    // Fetch batches linked to batch plans for progress
    const batchPlanIds = (batchPlans ?? []).map(bp => bp.id);
    const { data: batches } = batchPlanIds.length > 0
      ? await admin
          .from("batches")
          .select("id, batch_plan_id, quantity, status")
          .in("batch_plan_id", batchPlanIds)
      : { data: [] };

    // Build progress for each guide plan
    const result: GuidePlanWithProgress[] = (guidePlans ?? []).map((gp: any) => {
      // Get batch plans for this guide plan
      const gpBatchPlans = (batchPlans ?? []).filter(bp => bp.guide_plan_id === gp.id);
      const gpBatchPlanIds = gpBatchPlans.map(bp => bp.id);

      // Calculate totals
      const totalPlanned = gpBatchPlans.reduce((sum, bp) => sum + (bp.planned_quantity || 0), 0);

      const gpBatches = (batches ?? []).filter(b => gpBatchPlanIds.includes(b.batch_plan_id));
      const totalInBatches = gpBatches
        .filter(b => !["Archived", "Dumped"].includes(b.status ?? ""))
        .reduce((sum, b) => sum + (b.quantity || 0), 0);
      const totalCompleted = gpBatches
        .filter(b => ["Ready", "Shipped"].includes(b.status ?? ""))
        .reduce((sum, b) => sum + (b.quantity || 0), 0);

      return {
        id: gp.id,
        orgId: gp.org_id,
        name: gp.name,
        description: gp.description,
        targetFamily: gp.target_family,
        targetSizeId: gp.target_size_id,
        targetSizeName: gp.plant_sizes?.name ?? null,
        readyFromWeek: gp.ready_from_week,
        readyFromYear: gp.ready_from_year,
        readyToWeek: gp.ready_to_week,
        readyToYear: gp.ready_to_year,
        protocolId: gp.protocol_id,
        protocolName: gp.protocols?.name ?? null,
        targetQuantity: gp.target_quantity,
        status: gp.status,
        createdAt: gp.created_at,
        updatedAt: gp.updated_at,
        progress: buildGuidePlanProgress(
          gp.target_quantity,
          totalPlanned,
          totalInBatches,
          totalCompleted
        ),
        batchPlanCount: gpBatchPlans.length,
      };
    });

    return NextResponse.json({ guidePlans: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load guide plans";
    console.error("[guide-plans GET] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST - Create a new guide plan
export async function POST(req: Request) {
  try {
    const payload = CreateGuidePlanSchema.parse(await req.json());
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
        { error: "You don't have permission to create guide plans in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("guide_plans")
      .insert({
        org_id: orgId,
        name: payload.name,
        description: payload.description ?? null,
        target_family: payload.targetFamily,
        target_size_id: payload.targetSizeId ?? null,
        ready_from_week: payload.readyFromWeek,
        ready_from_year: payload.readyFromYear,
        ready_to_week: payload.readyToWeek,
        ready_to_year: payload.readyToYear,
        protocol_id: payload.protocolId ?? null,
        target_quantity: payload.targetQuantity,
        status: payload.status ?? "draft",
      })
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
      console.error("[guide-plans POST] insert failed:", error);
      throw new Error(error?.message ?? "Failed to create guide plan");
    }

    const guidePlan: GuidePlanWithProgress = {
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
      status: data.status as any,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      progress: buildGuidePlanProgress(data.target_quantity, 0, 0, 0),
      batchPlanCount: 0,
    };

    return NextResponse.json({ guidePlan }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create guide plan";
    console.error("[guide-plans POST] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
