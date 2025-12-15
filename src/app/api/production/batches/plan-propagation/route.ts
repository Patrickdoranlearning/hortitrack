import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";

const DateOnly = /^\d{4}-\d{2}-\d{2}$/;

const PlannedPropagationBatchSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid().optional(),
  expected_quantity: z.number().int().positive(),
  notes: z.string().max(1000).optional(),
});

const PlanPropagationSchema = z.object({
  planned_date: z.string().regex(DateOnly, "Use YYYY-MM-DD"),
  notes: z.string().max(2000).optional(),
  batches: z.array(PlannedPropagationBatchSchema).min(1, "At least one batch required"),
  create_job: z.boolean().optional().default(false),
  job_name: z.string().max(200).optional(),
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

// Get the internal supplier (owner nursery) for propagation/transplant batches
async function getInternalSupplierId(
  supabase: any,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("suppliers")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_internal", true)
    .maybeSingle();

  return data?.id ?? null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawPayload = await req.json();

    const payload = PlanPropagationSchema.parse(rawPayload);
    const { supabase, orgId, user } = await getUserAndOrg();

    // Resolve status_id for "Planned"
    const statusId = await resolveStatusId(supabase, orgId, "Planned");

    // Get the internal supplier (owner nursery) for propagation batches
    const internalSupplierId = await getInternalSupplierId(supabase, orgId);

    // Calculate expected ready date (21 days from planned date for propagation)
    const plannedDate = new Date(payload.planned_date);
    const readyDate = new Date(plannedDate);
    readyDate.setDate(readyDate.getDate() + 21);
    const readyDateStr = readyDate.toISOString().slice(0, 10);

    const results: any[] = [];
    const errors: string[] = [];

    // Process each planned batch
    for (const batchItem of payload.batches) {
      try {
        // Build log entry for planning
        const logEntry = {
          type: "planned",
          timestamp: new Date().toISOString(),
          userId: user.id,
          plannedDate: payload.planned_date,
          expectedQuantity: batchItem.expected_quantity,
          notes: batchItem.notes,
          globalNotes: payload.notes,
        };

        // Create batch with Planned status
        const batchNumber = await nextBatchNumber(1); // 1 = propagation phase counter

        const insertData: Record<string, any> = {
          org_id: orgId,
          batch_number: batchNumber,
          phase: "propagation",
          plant_variety_id: batchItem.plant_variety_id,
          size_id: batchItem.size_id,
          status: "Planned",
          status_id: statusId,
          quantity: batchItem.expected_quantity,
          initial_quantity: batchItem.expected_quantity,
          unit: "plants",
          planted_at: payload.planned_date,
          ready_at: readyDateStr,
          log_history: [logEntry],
        };

        // Set supplier to internal nursery (owner nursery grows propagation batches)
        if (internalSupplierId) {
          insertData.supplier_id = internalSupplierId;
        }

        // Only set location_id if provided
        if (batchItem.location_id) {
          insertData.location_id = batchItem.location_id;
        }

        const { data: batch, error } = await supabase
          .from("batches")
          .insert(insertData)
          .select("*")
          .single();

        if (error || !batch) {
          errors.push(`Failed to create batch: ${error?.message}`);
          continue;
        }

        // Log event
        await supabase.from("batch_events").insert({
          org_id: orgId,
          batch_id: batch.id,
          type: "PLANNED",
          by_user_id: user.id,
          payload: {
            plannedDate: payload.planned_date,
            expectedQuantity: batchItem.expected_quantity,
            notes: batchItem.notes,
            planType: "propagation",
          },
        });

        results.push(batch);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing batch: ${message}`);
      }
    }

    // Optionally create a production job to group these batches
    let jobId: string | null = null;
    if (payload.create_job && results.length > 0) {
      try {
        const { data: job, error: jobError } = await supabase
          .from("production_jobs")
          .insert({
            org_id: orgId,
            name: payload.job_name || `Propagation ${payload.planned_date}`,
            description: payload.notes,
            process_type: "propagation",
            scheduled_date: payload.planned_date,
            status: "unassigned",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (job && !jobError) {
          jobId = job.id;
          // Link batches to job
          const jobBatches = results.map((b, idx) => ({
            job_id: job.id,
            batch_id: b.id,
            sort_order: idx,
          }));
          await supabase.from("production_job_batches").insert(jobBatches);
        }
      } catch (jobErr) {
        // Don't fail the whole operation if job creation fails
      }
    }

    // Return results
    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: "All batches failed", errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        batches: results,
        created: results.length,
        jobId,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payload", issues: (error as any).issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to plan propagation batches";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
