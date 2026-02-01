import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import type { IpmTask } from "@/app/actions/ipm-tasks";

/**
 * Worker Scheduled Treatments API
 *
 * Returns upcoming IPM treatments for the current user/org.
 */

// Helper to normalize task data
function normalizeTask(row: Record<string, unknown>): IpmTask {
  const batches = row.batches as { id: string; batch_number: string; plant_varieties?: { name: string } } | null;
  const locations = row.nursery_locations as { id: string; name: string } | null;
  const products = row.ipm_products as { id: string; name: string; pcs_number?: string; harvest_interval_days?: number } | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    batchId: row.batch_id as string | undefined,
    locationId: row.location_id as string | undefined,
    programId: row.program_id as string | undefined,
    programStepId: row.program_step_id as string | undefined,
    spotTreatmentId: row.spot_treatment_id as string | undefined,
    productId: row.product_id as string,
    productName: row.product_name as string,
    rate: row.rate as number | undefined,
    rateUnit: row.rate_unit as string | undefined,
    method: row.method as string | undefined,
    isTankMix: (row.is_tank_mix as boolean) || false,
    tankMixGroupId: row.tank_mix_group_id as string | undefined,
    scheduledDate: row.scheduled_date as string,
    weekNumber: row.week_number as number,
    calendarWeek: row.calendar_week as number,
    status: row.status as IpmTask["status"],
    completedAt: row.completed_at as string | undefined,
    completedBy: row.completed_by as string | undefined,
    skipReason: row.skip_reason as string | undefined,
    bottleId: row.bottle_id as string | undefined,
    quantityUsedMl: row.quantity_used_ml as number | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    batch: batches ? {
      id: batches.id,
      batchNumber: batches.batch_number,
      variety: batches.plant_varieties?.name,
    } : undefined,
    location: locations ? {
      id: locations.id,
      name: locations.name,
    } : undefined,
    product: products ? {
      id: products.id,
      name: products.name,
      pcsNumber: products.pcs_number,
      whiDays: products.harvest_interval_days,
    } : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, orgId } = await getUserAndOrg();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Get today's date for filtering
    const today = new Date().toISOString().split("T")[0];

    // Get IPM tasks
    let query = supabase
      .from("ipm_tasks")
      .select(`
        *,
        batches (
          id,
          batch_number,
          plant_varieties (name)
        ),
        nursery_locations (id, name),
        ipm_products (id, name, pcs_number, harvest_interval_days)
      `)
      .eq("org_id", orgId)
      .order("scheduled_date", { ascending: true })
      .limit(limit);

    // Filter by status
    if (status === "pending") {
      query = query.in("status", ["pending", "overdue"]);
    } else if (status === "completed") {
      query = query.eq("status", "completed");
    } else if (status === "overdue") {
      query = query.eq("status", "overdue");
    } else if (status === "upcoming") {
      query = query.eq("status", "pending").gte("scheduled_date", today);
    } else if (status === "due_today") {
      query = query.eq("status", "pending").eq("scheduled_date", today);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/worker/scout/treatments] Query error:", error);
      return NextResponse.json(
        { error: "Failed to load treatments" },
        { status: 500 }
      );
    }

    const tasks = (data || []).map(normalizeTask);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[api/worker/scout/treatments] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load treatments" },
      { status: 500 }
    );
  }
}
