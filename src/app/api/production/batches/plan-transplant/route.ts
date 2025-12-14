import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";
import { inferPhase } from "@/lib/production/phase";

const ISOWeek = /^\d{4}-W\d{2}$/i;

const PlannedTransplantBatchSchema = z.object({
  source_batch_id: z.string().uuid(),
  target_size_id: z.string().uuid(),
  location_id: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  notes: z.string().max(1000).optional(),
});

const PlanTransplantSchema = z.object({
  planned_week: z.string().regex(ISOWeek, "Use YYYY-Www format (e.g., 2025-W50)"),
  notes: z.string().max(2000).optional(),
  transplants: z.array(PlannedTransplantBatchSchema).min(1, "At least one transplant required"),
  create_job: z.boolean().optional().default(false),
  job_name: z.string().max(200).optional(),
});

// Helper to get Monday of a given ISO week
function getWeekMonday(weekStr: string): Date {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/i);
  if (!match) throw new Error("Invalid week format");
  const [, year, week] = match;
  const jan4 = new Date(parseInt(year), 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(week) - 1) * 7);
  return monday;
}

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

const PHASE_COUNTER: Record<string, 1 | 2 | 3> = {
  propagation: 1,
  plug: 2,
  potted: 3,
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("[plan-transplant] POST request received");
  try {
    const rawPayload = await req.json();
    console.log("[plan-transplant] Raw payload:", JSON.stringify(rawPayload, null, 2));

    const payload = PlanTransplantSchema.parse(rawPayload);
    console.log("[plan-transplant] Payload validated successfully");

    const { supabase, orgId, user } = await getUserAndOrg();
    console.log("[plan-transplant] Auth successful, orgId:", orgId, "userId:", user?.id);

    console.log("[plan-transplant] Parsed payload for org:", orgId);

    // Resolve status_id for "Planned"
    const statusId = await resolveStatusId(supabase, orgId, "Planned");
    console.log("[plan-transplant] Resolved statusId for Planned:", statusId);

    // Get the internal supplier (owner nursery) for transplant batches
    const internalSupplierId = await getInternalSupplierId(supabase, orgId);
    console.log("[plan-transplant] Internal supplier ID:", internalSupplierId);

    // Fetch all source batches to validate and get variety info
    const sourceBatchIds = [...new Set(payload.transplants.map((t) => t.source_batch_id))];
    const { data: sourceBatches, error: sourceBatchesErr } = await supabase
      .from("batches")
      .select("id, batch_number, plant_variety_id, quantity, reserved_quantity")
      .in("id", sourceBatchIds);

    if (sourceBatchesErr) {
      console.error("[plan-transplant] Failed to fetch source batches:", sourceBatchesErr);
      return NextResponse.json({ error: "Failed to fetch source batches" }, { status: 500 });
    }

    const sourceBatchMap = new Map(sourceBatches?.map((b: any) => [b.id, b]) ?? []);

    // Fetch all target sizes for phase inference
    const targetSizeIds = [...new Set(payload.transplants.map((t) => t.target_size_id))];
    const { data: sizes, error: sizesErr } = await supabase
      .from("plant_sizes")
      .select("id, name, container_type, cell_multiple")
      .in("id", targetSizeIds);

    if (sizesErr) {
      console.error("[plan-transplant] Failed to fetch sizes:", sizesErr);
      return NextResponse.json({ error: "Failed to fetch sizes" }, { status: 500 });
    }

    const sizeMap = new Map(sizes?.map((s: any) => [s.id, s]) ?? []);

    // Calculate expected ready date (6 weeks from start of planned week)
    const plannedMonday = getWeekMonday(payload.planned_week);
    const plannedDateStr = plannedMonday.toISOString().slice(0, 10);
    const readyDate = new Date(plannedMonday);
    readyDate.setDate(readyDate.getDate() + 42); // 6 weeks
    const readyDateStr = readyDate.toISOString().slice(0, 10);

    const results: any[] = [];
    const errors: string[] = [];
    const reservationUpdates: Map<string, number> = new Map(); // batch_id -> additional reserved qty

    // Process each planned transplant
    for (const transplant of payload.transplants) {
      try {
        const sourceBatch = sourceBatchMap.get(transplant.source_batch_id);
        if (!sourceBatch) {
          errors.push(`Source batch not found: ${transplant.source_batch_id}`);
          continue;
        }

        const targetSize = sizeMap.get(transplant.target_size_id);
        if (!targetSize) {
          errors.push(`Target size not found: ${transplant.target_size_id}`);
          continue;
        }

        // Check if source batch has enough unreserved quantity
        const currentReserved = reservationUpdates.get(sourceBatch.id) || 0;
        const availableQty = sourceBatch.quantity - (sourceBatch.reserved_quantity || 0) - currentReserved;
        if (transplant.quantity > availableQty) {
          errors.push(
            `Insufficient quantity in source batch ${sourceBatch.batch_number}: requested ${transplant.quantity}, available ${availableQty}`
          );
          continue;
        }

        // Track reservation for this source batch
        reservationUpdates.set(
          sourceBatch.id,
          currentReserved + transplant.quantity
        );

        // Determine phase based on target size
        const phase = inferPhase({
          containerType: (targetSize.container_type as "pot" | "tray") ?? "pot",
          cellMultiple: targetSize.cell_multiple ?? 1,
        });

        // Build log entry for planning
        const logEntry = {
          type: "planned_transplant",
          timestamp: new Date().toISOString(),
          userId: user.id,
          plannedWeek: payload.planned_week,
          plannedDate: plannedDateStr,
          sourceBatchId: sourceBatch.id,
          sourceBatchNumber: sourceBatch.batch_number,
          quantity: transplant.quantity,
          targetSizeId: transplant.target_size_id,
          targetSizeName: targetSize.name,
          notes: transplant.notes,
          globalNotes: payload.notes,
        };

        // Create ghost batch with Planned status
        const phaseCounter = PHASE_COUNTER[phase] ?? 2;
        const batchNumber = await nextBatchNumber(phaseCounter);

        const insertData: Record<string, any> = {
          org_id: orgId,
          batch_number: batchNumber,
          phase,
          plant_variety_id: sourceBatch.plant_variety_id,
          size_id: transplant.target_size_id,
          parent_batch_id: sourceBatch.id, // Link to source batch
          status: "Planned",
          status_id: statusId,
          quantity: transplant.quantity,
          initial_quantity: transplant.quantity,
          unit: "plants",
          planted_at: plannedDateStr,
          ready_at: readyDateStr,
          log_history: [logEntry],
        };

        // Set supplier to internal nursery (owner nursery grows transplant batches)
        if (internalSupplierId) {
          insertData.supplier_id = internalSupplierId;
        }

        // Only set location_id if provided
        if (transplant.location_id) {
          insertData.location_id = transplant.location_id;
        }

        const { data: batch, error } = await supabase
          .from("batches")
          .insert(insertData)
          .select("*")
          .single();

        if (error || !batch) {
          console.error("[plan-transplant] Failed to create batch:", error);
          errors.push(`Failed to create planned batch: ${error?.message}`);
          // Rollback reservation tracking
          const prevReserved = reservationUpdates.get(sourceBatch.id) || 0;
          reservationUpdates.set(sourceBatch.id, prevReserved - transplant.quantity);
          continue;
        }

        // Log event
        await supabase.from("batch_events").insert({
          org_id: orgId,
          batch_id: batch.id,
          type: "PLANNED",
          by_user_id: user.id,
          payload: {
            plannedWeek: payload.planned_week,
            plannedDate: plannedDateStr,
            sourceBatchId: sourceBatch.id,
            sourceBatchNumber: sourceBatch.batch_number,
            quantity: transplant.quantity,
            targetSizeId: transplant.target_size_id,
            notes: transplant.notes,
            planType: "transplant",
          },
        });

        results.push({
          ...batch,
          sourceBatchNumber: sourceBatch.batch_number,
          targetSizeName: targetSize.name,
        });
      } catch (err: any) {
        console.error("[plan-transplant] Error processing transplant:", err);
        errors.push(`Error processing transplant: ${err.message}`);
      }
    }

    // Update reserved_quantity on source batches
    for (const [batchId, additionalReserved] of reservationUpdates.entries()) {
      if (additionalReserved > 0) {
        const sourceBatch = sourceBatchMap.get(batchId);
        if (sourceBatch) {
          const newReserved = (sourceBatch.reserved_quantity || 0) + additionalReserved;
          await supabase
            .from("batches")
            .update({ reserved_quantity: newReserved })
            .eq("id", batchId);
        }
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
            name: payload.job_name || `Transplant ${payload.planned_week}`,
            description: payload.notes,
            process_type: "transplant",
            scheduled_date: plannedDateStr,
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
      } catch (jobErr: any) {
        console.error("[plan-transplant] Error creating job:", jobErr);
        // Don't fail the whole operation if job creation fails
      }
    }

    // Return results
    if (results.length === 0 && errors.length > 0) {
      console.error("[plan-transplant] All transplants failed. Errors:", errors);
      return NextResponse.json(
        { error: "All transplants failed", errors },
        { status: 400 }
      );
    }

    console.log("[plan-transplant] Successfully created", results.length, "planned batches");

    return NextResponse.json(
      {
        batches: results,
        created: results.length,
        jobId,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[plan-transplant] Error:", error);
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error?.message ?? "Failed to plan transplants";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
