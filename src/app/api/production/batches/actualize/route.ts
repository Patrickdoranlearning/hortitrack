import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { consumeMaterialsForBatch } from "@/server/materials/consumption";

const ActualizeBatchSchema = z.object({
  batch_id: z.string().uuid(),
  actual_quantity: z.number().int().positive(),
  actual_location_id: z.string().uuid().optional(),
  actual_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  notes: z.string().max(1000).optional(),
  size_id: z.string().uuid().optional(), // For material consumption
});

const ActualizeSchema = z.object({
  batches: z.array(ActualizeBatchSchema).min(1, "At least one batch required"),
  job_id: z.string().uuid().optional(), // Optional: if actualizing as part of a job
  notes: z.string().max(2000).optional(),
  consume_materials: z.boolean().default(true), // Enable/disable material consumption
});

// Resolve status_id from attribute_options
async function resolveStatusId(
  supabase: any,
  orgId: string,
  statusCode: string
): Promise<string | null> {
  const { data } = await supabase
    .from("attribute_options")
    .select("id")
    .eq("org_id", orgId)
    .eq("attribute_key", "production_status")
    .ilike("system_code", statusCode)
    .maybeSingle();

  if (data) return data.id;

  // Fallback: create the status if it doesn't exist
  const { data: created } = await supabase
    .from("attribute_options")
    .insert({
      org_id: orgId,
      attribute_key: "production_status",
      system_code: statusCode,
      label: statusCode,
      sort_order: 0,
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[actualize] POST request received");
  try {
    const rawPayload = await req.json();
    console.log("[actualize] Raw payload:", JSON.stringify(rawPayload, null, 2));

    const payload = ActualizeSchema.parse(rawPayload);
    console.log("[actualize] Payload validated successfully");

    const { supabase, orgId, user } = await getUserAndOrg();
    console.log("[actualize] Auth successful, orgId:", orgId, "userId:", user?.id);

    // Resolve status_id for "Growing" (the active status)
    const growingStatusId = await resolveStatusId(supabase, orgId, "Growing");
    console.log("[actualize] Resolved statusId for Growing:", growingStatusId);

    // Fetch all batches to validate they exist and are in "Planned" status
    const batchIds = payload.batches.map((b) => b.batch_id);
    const { data: existingBatches, error: fetchError } = await supabase
      .from("batches")
      .select("id, batch_number, status, quantity, location_id, parent_batch_id, reserved_quantity")
      .in("id", batchIds)
      .eq("org_id", orgId);

    if (fetchError) {
      console.error("[actualize] Failed to fetch batches:", fetchError);
      return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
    }

    const batchMap = new Map(existingBatches?.map((b: any) => [b.id, b]) ?? []);

    const results: any[] = [];
    const errors: string[] = [];
    const sourceUpdates: Map<string, number> = new Map(); // parent_batch_id -> quantity consumed

    // Process each batch
    for (const item of payload.batches) {
      try {
        const batch = batchMap.get(item.batch_id);
        if (!batch) {
          errors.push(`Batch not found: ${item.batch_id}`);
          continue;
        }

        // Verify batch is in Planned status
        if (batch.status !== "Planned" && batch.status !== "Incoming") {
          errors.push(`Batch ${batch.batch_number} is not in Planned/Incoming status (current: ${batch.status})`);
          continue;
        }

        // Calculate quantity difference for transplants
        const quantityDiff = item.actual_quantity - batch.quantity;

        // Build log entry
        const logEntry = {
          type: "actualized",
          timestamp: new Date().toISOString(),
          userId: user.id,
          previousStatus: batch.status,
          newStatus: "Growing",
          plannedQuantity: batch.quantity,
          actualQuantity: item.actual_quantity,
          quantityDiff,
          actualDate: item.actual_date,
          notes: item.notes,
          globalNotes: payload.notes,
        };

        // Update batch to Growing status
        const updateData: Record<string, any> = {
          status: "Growing",
          status_id: growingStatusId,
          quantity: item.actual_quantity,
          planted_at: item.actual_date,
          updated_at: new Date().toISOString(),
        };

        // Update location if provided
        if (item.actual_location_id) {
          updateData.location_id = item.actual_location_id;
        }

        const { data: updatedBatch, error: updateError } = await supabase
          .from("batches")
          .update(updateData)
          .eq("id", item.batch_id)
          .eq("org_id", orgId)
          .select("*")
          .single();

        if (updateError) {
          console.error("[actualize] Failed to update batch:", updateError);
          errors.push(`Failed to actualize batch ${batch.batch_number}: ${updateError.message}`);
          continue;
        }

        // Append to log_history
        const currentHistory = updatedBatch.log_history || [];
        await supabase
          .from("batches")
          .update({ log_history: [...currentHistory, logEntry] })
          .eq("id", item.batch_id);

        // Log event
        await supabase.from("batch_events").insert({
          org_id: orgId,
          batch_id: item.batch_id,
          type: "ACTUALIZED",
          by_user_id: user.id,
          payload: {
            previousStatus: batch.status,
            plannedQuantity: batch.quantity,
            actualQuantity: item.actual_quantity,
            actualDate: item.actual_date,
            locationId: item.actual_location_id,
            notes: item.notes,
          },
        });

        // Track source batch consumption for transplants
        if (batch.parent_batch_id) {
          const currentConsumption = sourceUpdates.get(batch.parent_batch_id) || 0;
          sourceUpdates.set(batch.parent_batch_id, currentConsumption + item.actual_quantity);
        }

        // Consume materials if enabled and size_id is provided
        let materialConsumption = null;
        if (payload.consume_materials && item.size_id) {
          try {
            const consumptionResult = await consumeMaterialsForBatch(
              supabase,
              orgId,
              user.id,
              item.batch_id,
              batch.batch_number,
              item.size_id,
              item.actual_quantity,
              item.actual_location_id ?? null,
              true // allowPartial - don't fail if there's a shortage
            );
            materialConsumption = {
              success: consumptionResult.success,
              transactionCount: consumptionResult.transactions.length,
              shortages: consumptionResult.shortages,
            };
            console.log(`[actualize] Material consumption for batch ${batch.batch_number}:`, materialConsumption);
          } catch (consumeErr: any) {
            console.error("[actualize] Material consumption error:", consumeErr);
            // Don't fail the batch actualization if material consumption fails
            materialConsumption = { success: false, error: consumeErr.message };
          }
        }

        results.push({
          ...updatedBatch,
          previousStatus: batch.status,
          quantityDiff,
          materialConsumption,
        });
      } catch (err: any) {
        console.error("[actualize] Error processing batch:", err);
        errors.push(`Error processing batch: ${err.message}`);
      }
    }

    // Update source batches - consume quantity and release reservation
    for (const [parentId, consumed] of sourceUpdates.entries()) {
      const { data: parentBatch } = await supabase
        .from("batches")
        .select("quantity, reserved_quantity")
        .eq("id", parentId)
        .single();

      if (parentBatch) {
        // Reduce quantity and reserved_quantity
        const newQuantity = Math.max(0, parentBatch.quantity - consumed);
        const newReserved = Math.max(0, (parentBatch.reserved_quantity || 0) - consumed);

        await supabase
          .from("batches")
          .update({
            quantity: newQuantity,
            reserved_quantity: newReserved,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parentId);

        // Log the consumption
        await supabase.from("batch_events").insert({
          org_id: orgId,
          batch_id: parentId,
          type: "CONSUMED",
          by_user_id: user.id,
          payload: {
            consumedQuantity: consumed,
            remainingQuantity: newQuantity,
            reason: "transplant_actualized",
          },
        });
      }
    }

    // If this is part of a job, update job status
    if (payload.job_id) {
      try {
        const { data: job } = await supabase
          .from("production_jobs")
          .select("id, status, started_at")
          .eq("id", payload.job_id)
          .eq("org_id", orgId)
          .single();

        if (job) {
          const updateJobData: Record<string, any> = {
            status: "completed",
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          };

          // Set started_at if not already set
          if (!job.started_at) {
            updateJobData.started_at = new Date().toISOString();
          }

          await supabase
            .from("production_jobs")
            .update(updateJobData)
            .eq("id", payload.job_id);
        }
      } catch (jobErr: any) {
        console.error("[actualize] Error updating job:", jobErr);
        // Don't fail the whole operation if job update fails
      }
    }

    // Return results
    if (results.length === 0 && errors.length > 0) {
      console.error("[actualize] All batches failed. Errors:", errors);
      return NextResponse.json(
        { error: "All batches failed to actualize", errors },
        { status: 400 }
      );
    }

    console.log("[actualize] Successfully actualized", results.length, "batches");

    return NextResponse.json(
      {
        batches: results,
        actualized: results.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[actualize] Error:", error);
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error?.message ?? "Failed to actualize batches";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
