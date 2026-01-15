import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { nextBatchNumber } from "@/server/numbering/batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBatchesSchema = z.object({
  batchCount: z.number().int().min(1).max(100),
  quantities: z.array(z.number().int().positive()).optional(),
  locationId: z.string().uuid().optional().nullable(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  phase: z.enum(["propagation", "growing", "production"]).optional().default("production"),
  createJob: z.boolean().optional().default(false),
  jobName: z.string().max(200).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

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

// Get the internal supplier (owner nursery)
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

// POST - Create batches from a batch plan
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: batchPlanId } = await params;
    const payload = CreateBatchesSchema.parse(await req.json());
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
        { error: "You don't have permission to create batches in this organization" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch batch plan with related data
    const { data: batchPlan, error: bpError } = await admin
      .from("batch_plans")
      .select(`
        id,
        org_id,
        guide_plan_id,
        plant_variety_id,
        target_size_id,
        planned_quantity,
        ready_from_week,
        ready_from_year,
        ready_to_week,
        ready_to_year,
        protocol_id,
        notes
      `)
      .eq("id", batchPlanId)
      .eq("org_id", orgId)
      .single();

    if (bpError || !batchPlan) {
      return NextResponse.json({ error: "Batch plan not found" }, { status: 404 });
    }

    // Calculate quantities for each batch
    let quantities: number[];
    if (payload.quantities && payload.quantities.length === payload.batchCount) {
      quantities = payload.quantities;
    } else {
      // Auto-distribute: divide evenly, remainder goes to first batches
      const baseQty = Math.floor(batchPlan.planned_quantity / payload.batchCount);
      const remainder = batchPlan.planned_quantity % payload.batchCount;
      quantities = Array.from({ length: payload.batchCount }, (_, i) =>
        baseQty + (i < remainder ? 1 : 0)
      );
    }

    // Validate total matches planned quantity
    const totalQty = quantities.reduce((sum, q) => sum + q, 0);
    if (totalQty !== batchPlan.planned_quantity) {
      return NextResponse.json(
        { error: `Quantities must sum to ${batchPlan.planned_quantity}, got ${totalQty}` },
        { status: 400 }
      );
    }

    // Resolve status and supplier
    const statusId = await resolveStatusId(supabase, orgId, "Planned");
    const internalSupplierId = await getInternalSupplierId(supabase, orgId);

    // Calculate ready date from batch plan's ready_from_week/year
    let readyDateStr: string | null = null;
    if (batchPlan.ready_from_week && batchPlan.ready_from_year) {
      // Convert week/year to date (Monday of that week)
      const jan1 = new Date(batchPlan.ready_from_year, 0, 1);
      const dayOfWeek = jan1.getDay();
      const daysToMonday = dayOfWeek <= 1 ? 1 - dayOfWeek : 8 - dayOfWeek;
      const firstMonday = new Date(jan1);
      firstMonday.setDate(jan1.getDate() + daysToMonday);
      const readyDate = new Date(firstMonday);
      readyDate.setDate(readyDate.getDate() + (batchPlan.ready_from_week - 1) * 7);
      readyDateStr = readyDate.toISOString().slice(0, 10);
    }

    const plannedDate = payload.plannedDate ?? new Date().toISOString().slice(0, 10);
    const results: any[] = [];
    const errors: string[] = [];

    // Create batches
    for (let i = 0; i < payload.batchCount; i++) {
      try {
        const batchNumber = await nextBatchNumber(payload.phase === "propagation" ? 1 : 2);

        const logEntry = {
          type: "planned",
          timestamp: new Date().toISOString(),
          userId: user.id,
          source: "batch_plan",
          batchPlanId: batchPlan.id,
          guidePlanId: batchPlan.guide_plan_id,
          plannedDate,
          expectedQuantity: quantities[i],
          notes: batchPlan.notes,
        };

        const insertData: Record<string, any> = {
          org_id: orgId,
          batch_number: batchNumber,
          phase: payload.phase,
          plant_variety_id: batchPlan.plant_variety_id,
          size_id: batchPlan.target_size_id,
          status: "Planned",
          status_id: statusId,
          quantity: quantities[i],
          initial_quantity: quantities[i],
          unit: "plants",
          planted_at: plannedDate,
          batch_plan_id: batchPlan.id,
          log_history: [logEntry],
        };

        if (readyDateStr) {
          insertData.ready_at = readyDateStr;
        }

        if (payload.locationId) {
          insertData.location_id = payload.locationId;
        }

        if (internalSupplierId) {
          insertData.supplier_id = internalSupplierId;
        }

        const { data: batch, error } = await supabase
          .from("batches")
          .insert(insertData)
          .select("*")
          .single();

        if (error || !batch) {
          errors.push(`Failed to create batch ${i + 1}: ${error?.message}`);
          continue;
        }

        // Log event
        await supabase.from("batch_events").insert({
          org_id: orgId,
          batch_id: batch.id,
          type: "PLANNED",
          by_user_id: user.id,
          payload: {
            plannedDate,
            expectedQuantity: quantities[i],
            source: "batch_plan",
            batchPlanId: batchPlan.id,
          },
        });

        results.push(batch);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error creating batch ${i + 1}: ${message}`);
      }
    }

    // Update batch plan status to active if batches were created
    if (results.length > 0) {
      await admin
        .from("batch_plans")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", batchPlanId);
    }

    // Optionally create a production job
    let jobId: string | null = null;
    if (payload.createJob && results.length > 0) {
      try {
        const { data: job, error: jobError } = await supabase
          .from("production_jobs")
          .insert({
            org_id: orgId,
            name: payload.jobName || `Batch Plan Execution - ${plannedDate}`,
            description: batchPlan.notes,
            process_type: payload.phase,
            scheduled_date: plannedDate,
            status: "unassigned",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (job && !jobError) {
          jobId = job.id;
          const jobBatches = results.map((b, idx) => ({
            job_id: job.id,
            batch_id: b.id,
            sort_order: idx,
          }));
          await supabase.from("production_job_batches").insert(jobBatches);
        }
      } catch {
        // Don't fail if job creation fails
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: "All batches failed to create", errors },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create batches from plan";
    console.error("[batch-plans/[id]/create-batches POST] error:", message);
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
