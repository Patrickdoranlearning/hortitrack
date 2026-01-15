import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// GET - Find batches that match the guide plan's criteria (family, size) but aren't linked to any batch plan
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id: guidePlanId } = await params;
    const { orgId } = await getUserAndOrg();
    const admin = getSupabaseAdmin();

    // Get the guide plan details
    const { data: guidePlan, error: gpError } = await admin
      .from("guide_plans")
      .select(`
        id,
        target_family,
        target_size_id,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year
      `)
      .eq("id", guidePlanId)
      .eq("org_id", orgId)
      .single();

    if (gpError || !guidePlan) {
      return NextResponse.json({ error: "Guide plan not found" }, { status: 404 });
    }

    // Get all varieties in the target family
    const { data: varieties } = await admin
      .from("plant_varieties")
      .select("id, name, family")
      .eq("org_id", orgId)
      .ilike("family", guidePlan.target_family);

    const varietyIds = (varieties ?? []).map(v => v.id);

    if (varietyIds.length === 0) {
      return NextResponse.json({
        guidePlanId,
        targetFamily: guidePlan.target_family,
        matchingBatches: [],
        batchesByVariety: [],
        summary: {
          totalBatches: 0,
          totalQuantity: 0,
          varietyCount: 0,
        },
      });
    }

    // Find all batches that:
    // 1. Match the family (via variety)
    // 2. Match the size (if specified)
    // 3. Are not archived/dumped
    // 4. Are NOT already linked to a batch plan
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
        plant_variety_id,
        batch_plan_id,
        plant_varieties(id, name, family),
        plant_sizes(name)
      `)
      .eq("org_id", orgId)
      .in("plant_variety_id", varietyIds)
      .not("status", "in", '("Archived","Dumped")')
      .is("batch_plan_id", null)
      .order("plant_variety_id")
      .order("ready_at", { ascending: true });

    // Filter by size if specified
    if (guidePlan.target_size_id) {
      query = query.eq("size_id", guidePlan.target_size_id);
    }

    const { data: batches, error: batchError } = await query;

    if (batchError) {
      console.error("[guide-plan matching-batches GET] query failed:", batchError);
      throw new Error(batchError.message);
    }

    // Group batches by variety
    const batchesByVariety: Record<string, {
      varietyId: string;
      varietyName: string;
      varietyFamily: string;
      batches: any[];
      totalQuantity: number;
    }> = {};

    for (const batch of batches ?? []) {
      const varietyId = batch.plant_variety_id;
      const variety = (batch as any).plant_varieties;

      if (!batchesByVariety[varietyId]) {
        batchesByVariety[varietyId] = {
          varietyId,
          varietyName: variety?.name ?? 'Unknown',
          varietyFamily: variety?.family ?? '',
          batches: [],
          totalQuantity: 0,
        };
      }

      batchesByVariety[varietyId].batches.push({
        id: batch.id,
        batchNumber: batch.batch_number,
        quantity: batch.quantity,
        status: batch.status,
        phase: batch.phase,
        readyAt: batch.ready_at,
        sizeName: (batch as any).plant_sizes?.name ?? null,
      });
      batchesByVariety[varietyId].totalQuantity += batch.quantity || 0;
    }

    const varietyGroups = Object.values(batchesByVariety);

    return NextResponse.json({
      guidePlanId,
      targetFamily: guidePlan.target_family,
      targetSizeId: guidePlan.target_size_id,
      matchingBatches: (batches ?? []).map(b => ({
        id: b.id,
        batchNumber: b.batch_number,
        quantity: b.quantity,
        status: b.status,
        phase: b.phase,
        readyAt: b.ready_at,
        sizeId: b.size_id,
        sizeName: (b as any).plant_sizes?.name ?? null,
        varietyId: b.plant_variety_id,
        varietyName: (b as any).plant_varieties?.name ?? null,
        varietyFamily: (b as any).plant_varieties?.family ?? null,
      })),
      batchesByVariety: varietyGroups,
      summary: {
        totalBatches: (batches ?? []).length,
        totalQuantity: (batches ?? []).reduce((sum, b) => sum + (b.quantity || 0), 0),
        varietyCount: varietyGroups.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to find matching batches";
    console.error("[guide-plan matching-batches GET] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
