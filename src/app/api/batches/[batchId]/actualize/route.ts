import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { captureProtocolPerformance } from "@/server/production/protocol-performance";

const ActualizeSchema = z.object({
  quantity: z.number().int().positive(),
  locationId: z.string().min(1),
  status: z.enum([
    "Propagation",
    "Plugs/Liners",
    "Potted",
    "Looking Good",
    "Ready",
  ]),
  plantedAt: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const payload = ActualizeSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Fetch the batch to verify ownership and status
    const { data: batch, error: fetchError } = await supabase
      .from("batches")
      .select("*")
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Verify batch is in Planned or Incoming status
    if (batch.status !== "Planned" && batch.status !== "Incoming") {
      return NextResponse.json(
        { error: "Only Planned or Incoming batches can be actualized" },
        { status: 400 }
      );
    }

    const originalQuantity = batch.quantity ?? 0;
    const quantityDiff = payload.quantity - originalQuantity;
    const isIncoming = batch.status === "Incoming";
    const isPlanned = batch.status === "Planned";

    // If this was a planned batch with a parent, update the parent's quantities
    // CRITICAL: Parent update must succeed for data integrity
    if (isPlanned && batch.parent_batch_id) {
      // Fetch parent batch to update its quantities
      const { data: parentBatch, error: parentErr } = await supabase
        .from("batches")
        .select("id, quantity, reserved_quantity")
        .eq("id", batch.parent_batch_id)
        .eq("org_id", orgId)
        .single();

      if (parentErr) {
        console.error("[actualize] Failed to fetch parent batch:", parentErr);
        return NextResponse.json(
          { error: "Failed to fetch parent batch for quantity update" },
          { status: 500 }
        );
      }

      if (parentBatch) {
        const parentReserved = parentBatch.reserved_quantity ?? 0;
        const parentQuantity = parentBatch.quantity ?? 0;

        // Release the reservation (by the originally planned amount)
        // and deduct the actual quantity being transferred
        const newReserved = Math.max(0, parentReserved - originalQuantity);
        const newQuantity = Math.max(0, parentQuantity - payload.quantity);

        const { error: parentUpdateErr } = await supabase
          .from("batches")
          .update({
            reserved_quantity: newReserved,
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", batch.parent_batch_id)
          .eq("org_id", orgId);

        if (parentUpdateErr) {
          console.error("[actualize] Failed to update parent batch:", parentUpdateErr);
          // FAIL the operation to maintain data integrity
          return NextResponse.json(
            { error: "Failed to update parent batch quantities. Please try again." },
            { status: 500 }
          );
        }
      }
    }

    // Build log entry
    const logEntry = {
      type: isIncoming ? "stock_received" : "batch_actualized",
      timestamp: new Date().toISOString(),
      userId: user.id,
      previousStatus: batch.status,
      newStatus: payload.status,
      previousQuantity: originalQuantity,
      newQuantity: payload.quantity,
      quantityAdjustment: quantityDiff,
      locationId: payload.locationId,
      plantedAt: payload.plantedAt,
      notes: payload.notes ?? null,
      parentBatchId: batch.parent_batch_id ?? null,
    };

    // Merge with existing log history
    const existingHistory = Array.isArray(batch.log_history) ? batch.log_history : [];
    const updatedHistory = [...existingHistory, logEntry];

    // Determine DB status and phase based on requested status
    let dbStatus = "Growing"; // Default
    let dbPhase: string | null = null;

    if (payload.status === "Looking Good") {
      dbStatus = "Looking Good";
    } else if (payload.status === "Ready") {
      dbStatus = "Ready";
    } else if (payload.status === "Propagation") {
      dbPhase = "propagation";
    } else if (payload.status === "Plugs/Liners") {
      dbPhase = "plug_linear";
    } else if (payload.status === "Potted") {
      dbPhase = "potted";
    }

    // Resolve status_id for the new dbStatus
    let statusId = undefined;
    const { data: sOpt } = await supabase
      .from("attribute_options")
      .select("id")
      .eq("org_id", orgId)
      .eq("attribute_key", "production_status")
      .or(`system_code.eq.${dbStatus},display_label.eq.${dbStatus}`)
      .single();
    if (sOpt) statusId = sOpt.id;

    // Build update object
    const updateData: Record<string, any> = {
      status: dbStatus,
      status_id: statusId,
      quantity: payload.quantity,
      initial_quantity: payload.quantity, // Reset initial quantity to actual
      location_id: payload.locationId,
      planted_at: payload.plantedAt,
      log_history: updatedHistory,
      updated_at: new Date().toISOString(),
    };

    if (dbPhase) {
      updateData.phase = dbPhase;
    }

    // Update the batch
    const { data: updated, error: updateError } = await supabase
      .from("batches")
      .update(updateData)
      .eq("id", batchId)
      .eq("org_id", orgId)
      .select("*")
      .single();

    if (updateError) {
      console.error("[actualize] update error", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    try {
      // Create an event log
      // Check if "events" table exists, if not use "batch_events"
      const { error: eventError } = await supabase.from("batch_events").insert({
        org_id: orgId,
        batch_id: batchId,
        type: isIncoming ? "stock_received" : "batch_actualized",
        payload: {
          previousStatus: batch.status,
          newStatus: payload.status,
          quantityPlanned: originalQuantity,
          quantityActual: payload.quantity,
          quantityDiff,
          locationId: payload.locationId,
          notes: payload.notes,
          parentBatchId: batch.parent_batch_id ?? null,
        },
        by_user_id: user.id,
        at: payload.plantedAt,
      });
      
      if (eventError) {
          console.error("[actualize] event log error", eventError);
          // Continue anyway
      }
    } catch (evtErr) {
      console.error("[actualize] unexpected event log error", evtErr);
    }

    // Capture protocol performance when batch reaches Ready status
    if (payload.status === "Ready") {
      captureProtocolPerformance(supabase, orgId, batchId).catch((err) => {
        console.error("[actualize] Failed to capture protocol performance:", err);
      });
    }

    return NextResponse.json({ batch: updated }, { status: 200 });
  } catch (err: any) {
    console.error("[actualize] error", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

