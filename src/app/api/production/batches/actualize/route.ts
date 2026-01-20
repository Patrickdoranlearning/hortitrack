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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawPayload = await req.json();

    const payload = ActualizeSchema.parse(rawPayload);

    const { supabase, orgId, user } = await getUserAndOrg();

    const results: any[] = [];
    const errors: string[] = [];

    // Process each batch using the atomic RPC function
    // This ensures all updates (batch status, parent consumption, event logging)
    // happen in a single database transaction
    for (const item of payload.batches) {
      try {
        // Call atomic actualization function
        // This handles: batch update, parent batch consumption, event logging
        // All in a single transaction - if any step fails, all changes are rolled back
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "actualize_batch",
          {
            p_org_id: orgId,
            p_batch_id: item.batch_id,
            p_actual_quantity: item.actual_quantity,
            p_actual_date: item.actual_date,
            p_user_id: user.id,
            p_location_id: item.actual_location_id ?? null,
            p_notes: item.notes ?? null,
          }
        );

        if (rpcError) {
          // Extract user-friendly error message from RPC error
          const errorMsg = rpcError.message || "Failed to actualize batch";
          errors.push(errorMsg);
          continue;
        }

        if (!rpcResult?.success) {
          errors.push(rpcResult?.error || `Failed to actualize batch ${item.batch_id}`);
          continue;
        }

        // Fetch the updated batch for the response
        const { data: updatedBatch } = await supabase
          .from("batches")
          .select("*")
          .eq("id", item.batch_id)
          .single();

        // Consume materials if enabled and size_id is provided
        // This is kept separate as it has its own partial success logic
        let materialConsumption = null;
        if (payload.consume_materials && item.size_id && updatedBatch) {
          try {
            const consumptionResult = await consumeMaterialsForBatch(
              supabase,
              orgId,
              user.id,
              item.batch_id,
              updatedBatch.batch_number,
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
          } catch (consumeErr) {
            // Don't fail the batch actualization if material consumption fails
            const errMsg = consumeErr instanceof Error ? consumeErr.message : "Unknown error";
            materialConsumption = { success: false, error: errMsg };
          }
        }

        results.push({
          ...updatedBatch,
          previousStatus: rpcResult.previousStatus,
          quantityDiff: rpcResult.quantityDiff,
          materialConsumption,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing batch: ${message}`);
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
      } catch (jobErr) {
        // Don't fail the whole operation if job update fails
      }
    }

    // Return results
    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: "All batches failed to actualize", errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        batches: results,
        actualized: results.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payload", issues: (error as any).issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to actualize batches";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
