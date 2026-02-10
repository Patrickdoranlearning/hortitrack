import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Find batches that match the batch plan's criteria (variety, size) but aren't linked yet
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id: batchPlanId } = await params;
    const { orgId } = await getUserAndOrg();
    const admin = getSupabaseAdmin();

    // Get the batch plan details
    const { data: batchPlan, error: bpError } = await admin
      .from("batch_plans")
      .select(`
        id,
        plant_variety_id,
        target_size_id,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year,
        guide_plans(
          ready_from_week,
          ready_from_year,
          ready_to_week,
          ready_to_year,
          target_size_id
        )
      `)
      .eq("id", batchPlanId)
      .eq("org_id", orgId)
      .single();

    if (bpError || !batchPlan) {
      return NextResponse.json({ error: "Batch plan not found" }, { status: 404 });
    }

    // Determine effective timeline (batch plan's own or inherited from guide plan)
    const guidePlan = (batchPlan as any).guide_plans;
    const effectiveTimeline = {
      fromWeek: batchPlan.ready_from_week ?? guidePlan?.ready_from_week,
      fromYear: batchPlan.ready_from_year ?? guidePlan?.ready_from_year,
      toWeek: batchPlan.ready_to_week ?? guidePlan?.ready_to_week,
      toYear: batchPlan.ready_to_year ?? guidePlan?.ready_to_year,
    };

    // Effective size (batch plan's own or inherited from guide plan)
    const effectiveSizeId = batchPlan.target_size_id ?? guidePlan?.target_size_id;

    // Build query for matching batches
    let query = admin
      .from("batches")
      .select(`
        id,
        batch_number,
        quantity,
        status,
        phase,
        ready_at,
        size_id,
        batch_plan_id,
        plant_variety_id,
        plant_varieties(name, family),
        plant_sizes(name)
      `)
      .eq("org_id", orgId)
      .eq("plant_variety_id", batchPlan.plant_variety_id)
      .not("status", "in", '("Archived","Dumped")')
      .order("ready_at", { ascending: true });

    // Filter by size if specified
    if (effectiveSizeId) {
      query = query.eq("size_id", effectiveSizeId);
    }

    const { data: batches, error: batchError } = await query;

    if (batchError) {
      logger.production.error("Batch plan matching-batches query failed", batchError);
      throw new Error(batchError.message);
    }

    // Separate into linked and unlinked batches
    const linkedBatches = (batches ?? []).filter(b => b.batch_plan_id === batchPlanId);
    const unlinkedBatches = (batches ?? []).filter(b => !b.batch_plan_id);
    const linkedToOther = (batches ?? []).filter(b => b.batch_plan_id && b.batch_plan_id !== batchPlanId);

    // Transform to consistent format
    const transformBatch = (b: any) => ({
      id: b.id,
      batchNumber: b.batch_number,
      quantity: b.quantity,
      status: b.status,
      phase: b.phase,
      readyAt: b.ready_at,
      sizeId: b.size_id,
      sizeName: b.plant_sizes?.name ?? null,
      varietyName: b.plant_varieties?.name ?? null,
      varietyFamily: b.plant_varieties?.family ?? null,
      batchPlanId: b.batch_plan_id,
    });

    return NextResponse.json({
      batchPlanId,
      varietyId: batchPlan.plant_variety_id,
      sizeId: effectiveSizeId,
      timeline: effectiveTimeline,
      linkedBatches: linkedBatches.map(transformBatch),
      matchingBatches: unlinkedBatches.map(transformBatch),
      linkedToOtherPlans: linkedToOther.map(transformBatch),
      summary: {
        linkedCount: linkedBatches.length,
        linkedQuantity: linkedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0),
        matchingCount: unlinkedBatches.length,
        matchingQuantity: unlinkedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to find matching batches";
    logger.production.error("Batch plan matching-batches failed", error);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
