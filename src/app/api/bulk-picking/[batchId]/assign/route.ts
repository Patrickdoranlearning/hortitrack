import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";
import { autoAssignBatchItems } from "@/lib/picking/auto-assign";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

interface ManualAssignBody {
  itemId: string;
  assignedTo: string | null;
}

// ---------------------------------------------------------------------------
// POST /api/bulk-picking/[batchId]/assign - Run auto-assignment on the batch
// ---------------------------------------------------------------------------
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    // Verify batch belongs to this org
    const { data: batch, error: batchError } = await supabase
      .from("bulk_pick_batches")
      .select("id, status")
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Only allow assignment on pending or in_progress batches
    if (!["pending", "in_progress"].includes(batch.status as string)) {
      return NextResponse.json(
        { error: `Cannot assign items on a batch with status "${batch.status}"` },
        { status: 400 },
      );
    }

    const results = await autoAssignBatchItems(supabase, batchId, orgId);

    const assignedCount = results.filter((r) => r.assignedTo !== null).length;
    const unassignedCount = results.filter((r) => r.assignedTo === null).length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        assigned: assignedCount,
        unassigned: unassignedCount,
      },
      assignments: results,
    });
  } catch (error) {
    logger.picking.error("Auto-assign POST failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/bulk-picking/[batchId]/assign - Manual assign/reassign a single item
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const body: unknown = await req.json();
    const { itemId, assignedTo } = body as ManualAssignBody;

    // Validate input
    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json(
        { error: "itemId is required and must be a string" },
        { status: 400 },
      );
    }

    if (assignedTo !== null && typeof assignedTo !== "string") {
      return NextResponse.json(
        { error: "assignedTo must be a string (user ID) or null to unassign" },
        { status: 400 },
      );
    }

    // Verify batch belongs to this org
    const { data: batch, error: batchError } = await supabase
      .from("bulk_pick_batches")
      .select("id, status")
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Only allow assignment on pending or in_progress batches
    if (!["pending", "in_progress"].includes(batch.status as string)) {
      return NextResponse.json(
        { error: `Cannot reassign items on a batch with status "${batch.status}"` },
        { status: 400 },
      );
    }

    // Verify item belongs to this batch
    const { data: item, error: itemError } = await supabase
      .from("bulk_pick_items")
      .select("id, assigned_to, status")
      .eq("id", itemId)
      .eq("bulk_batch_id", batchId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Item not found in this batch" },
        { status: 404 },
      );
    }

    // If assigning to a user, verify they exist (optional but good guard)
    if (assignedTo !== null) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", assignedTo)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: "Assigned user not found" },
          { status: 400 },
        );
      }
    }

    // Update the assignment
    const { data: updatedItem, error: updateError } = await supabase
      .from("bulk_pick_items")
      .update({ assigned_to: assignedTo })
      .eq("id", itemId)
      .eq("bulk_batch_id", batchId)
      .select(
        `
        id,
        sku_id,
        total_qty,
        picked_qty,
        status,
        assigned_to,
        size_category_id,
        location_hint,
        sku:skus(
          id,
          sku_code,
          plant_variety:plant_varieties(name),
          plant_size:plant_sizes(name)
        )
      `,
      )
      .single();

    if (updateError) {
      logger.picking.error("Manual assign: failed to update item", updateError, {
        batchId,
        itemId,
      });
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    logger.picking.info("Manual assignment completed", {
      batchId,
      itemId,
      previousAssignee: (item as Record<string, unknown>).assigned_to ?? null,
      newAssignee: assignedTo,
    });

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    logger.picking.error("Manual assign PATCH failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
