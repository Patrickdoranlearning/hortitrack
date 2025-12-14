import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";
import { inferPhase } from "@/lib/production/phase";

const DateOnly = /^\d{4}-\d{2}-\d{2}$/;

const PlannedBatchSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid().optional(), // Location may not be known yet
  expected_quantity: z.number().int().positive(),
  notes: z.string().max(1000).optional(),
});

const PlanIncomingSchema = z.object({
  supplier_id: z.string().uuid(),
  expected_date: z.string().regex(DateOnly, "Use YYYY-MM-DD"),
  supplier_reference: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  batches: z.array(PlannedBatchSchema).min(1, "At least one batch required"),
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

const PHASE_COUNTER: Record<string, 1 | 2 | 3> = {
  propagation: 1,
  plug: 2,
  potted: 3,
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const rawPayload = await req.json();
    console.log("[plan-incoming] Raw payload:", JSON.stringify(rawPayload, null, 2));

    const payload = PlanIncomingSchema.parse(rawPayload);
    const { supabase, orgId, user } = await getUserAndOrg();

    console.log("[plan-incoming] Parsed payload for org:", orgId);

    // Resolve status_id for "Incoming"
    const statusId = await resolveStatusId(supabase, orgId, "Incoming");
    console.log("[plan-incoming] Resolved statusId for Incoming:", statusId);

    // Fetch all sizes for phase inference
    const sizeIds = [...new Set(payload.batches.map((b) => b.size_id))];
    const { data: sizes, error: sizesErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .in("id", sizeIds);

    if (sizesErr) {
      console.error("[plan-incoming] Failed to fetch sizes:", sizesErr);
      return NextResponse.json({ error: "Failed to fetch sizes" }, { status: 500 });
    }

    const sizeMap = new Map(sizes?.map((s: any) => [s.id, s]) ?? []);
    console.log("[plan-incoming] Fetched sizes:", sizes?.length ?? 0);

    // Calculate expected ready date (21 days from expected delivery)
    const expectedDate = new Date(payload.expected_date);
    const readyDate = new Date(expectedDate);
    readyDate.setDate(readyDate.getDate() + 21);
    const readyDateStr = readyDate.toISOString().slice(0, 10);

    const results: any[] = [];
    const errors: string[] = [];

    // Process each planned batch
    for (const batchItem of payload.batches) {
      try {
        const size = sizeMap.get(batchItem.size_id);
        if (!size) {
          errors.push(`Size not found for batch`);
          continue;
        }

        const phase = inferPhase({
          containerType: (size.container_type as "pot" | "tray") ?? "pot",
          cellMultiple: size.cell_multiple ?? 1,
        });

        // Build log entry for planning
        const logEntry = {
          type: "planned",
          timestamp: new Date().toISOString(),
          userId: user.id,
          expectedDate: payload.expected_date,
          supplierId: payload.supplier_id,
          supplierReference: payload.supplier_reference,
          expectedQuantity: batchItem.expected_quantity,
          notes: batchItem.notes,
          globalNotes: payload.notes,
        };

        // Create batch with Incoming status
        const phaseCounter = PHASE_COUNTER[phase] ?? 2;
        const batchNumber = await nextBatchNumber(phaseCounter);

        const insertData: Record<string, any> = {
          org_id: orgId,
          batch_number: batchNumber,
          phase,
          plant_variety_id: batchItem.plant_variety_id,
          size_id: batchItem.size_id,
          supplier_id: payload.supplier_id,
          status: "Incoming",
          status_id: statusId,
          quantity: batchItem.expected_quantity,
          initial_quantity: batchItem.expected_quantity,
          unit: "plants",
          planted_at: payload.expected_date, // Expected delivery date
          ready_at: readyDateStr,
          supplier_batch_number: payload.supplier_reference ?? "",
          log_history: [logEntry],
        };

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
          console.error("[plan-incoming] Failed to create batch:", error);
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
            expectedDate: payload.expected_date,
            supplierId: payload.supplier_id,
            supplierReference: payload.supplier_reference,
            expectedQuantity: batchItem.expected_quantity,
            notes: batchItem.notes,
          },
        });

        results.push(batch);
      } catch (err: any) {
        console.error("[plan-incoming] Error processing batch:", err);
        errors.push(`Error processing batch: ${err.message}`);
      }
    }

    // Return results
    if (results.length === 0 && errors.length > 0) {
      console.error("[plan-incoming] All batches failed. Errors:", errors);
      return NextResponse.json(
        { error: "All batches failed", errors },
        { status: 400 }
      );
    }

    console.log("[plan-incoming] Successfully created", results.length, "batches");

    return NextResponse.json(
      {
        batches: results,
        created: results.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[plan-incoming] Error:", error);
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error?.message ?? "Failed to plan incoming batches";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
