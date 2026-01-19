import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";
import { inferPhase } from "@/lib/production/phase";
import { consumeMaterialsForBatch } from "@/server/materials/consumption";

const DateOnly = /^\d{4}-\d{2}-\d{2}$/;

const BatchItemSchema = z.object({
  incoming_batch_id: z.string().uuid().optional(),
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  quality_rating: z.number().int().min(1).max(6).optional(),
  pest_or_disease: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

const MultiCheckInSchema = z.object({
  supplier_id: z.string().uuid(),
  delivery_date: z.string().regex(DateOnly, "Use YYYY-MM-DD"),
  supplier_reference: z.string().max(120).optional(),
  overall_quality: z.number().int().min(1).max(6),
  global_notes: z.string().max(2000).optional(),
  batches: z.array(BatchItemSchema).min(1, "At least one batch required"),
  photo_count: z.number().int().min(0).optional(),
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

  // Fallback to Growing if not found
  const { data: fallback } = await supabase
    .from("attribute_options")
    .select("id")
    .eq("org_id", orgId)
    .eq("attribute_key", "production_status")
    .eq("system_code", "Growing")
    .maybeSingle();

  return fallback?.id ?? null;
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

    const payload = MultiCheckInSchema.parse(rawPayload);
    const { supabase, orgId, user } = await getUserAndOrg();

    // Resolve status_id for "Growing"
    const statusId = await resolveStatusId(supabase, orgId, "Growing");

    // Fetch all sizes for phase inference and cell_multiple
    const sizeIds = [...new Set(payload.batches.map((b) => b.size_id))];
    const { data: sizes, error: sizesErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .in("id", sizeIds);

    if (sizesErr) {
      return NextResponse.json({ error: "Failed to fetch sizes" }, { status: 500 });
    }

    const sizeMap = new Map(sizes?.map((s: any) => [s.id, s]) ?? []);

    // Calculate ready date (21 days from delivery)
    const deliveryDate = new Date(payload.delivery_date);
    const readyDate = new Date(deliveryDate);
    readyDate.setDate(readyDate.getDate() + 21);
    const readyDateStr = readyDate.toISOString().slice(0, 10);

    const results: any[] = [];
    const errors: string[] = [];

    // Process each batch
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

        // Build log entry
        const logEntry = {
          type: "stock_received",
          timestamp: new Date().toISOString(),
          userId: user.id,
          deliveryDate: payload.delivery_date,
          supplierId: payload.supplier_id,
          supplierReference: payload.supplier_reference,
          quantity: batchItem.quantity,
          qualityRating: batchItem.quality_rating ?? payload.overall_quality,
          pestOrDisease: batchItem.pest_or_disease,
          notes: batchItem.notes,
          globalNotes: payload.global_notes,
        };

        // If this is actualizing an incoming batch
        if (batchItem.incoming_batch_id) {
          // Verify the incoming batch exists and belongs to this org
          const { data: incomingBatch, error: incomingErr } = await supabase
            .from("batches")
            .select("*")
            .eq("id", batchItem.incoming_batch_id)
            .eq("org_id", orgId)
            .single();

          if (incomingErr || !incomingBatch) {
            errors.push(`Incoming batch ${batchItem.incoming_batch_id} not found`);
            continue;
          }

          if (incomingBatch.status !== "Incoming") {
            errors.push(`Batch ${batchItem.incoming_batch_id} is not in Incoming status`);
            continue;
          }

          const existingHistory = Array.isArray(incomingBatch.log_history)
            ? incomingBatch.log_history
            : [];

          // Update the incoming batch
          // Note: quality_rating and pest_or_disease are stored in log_history, not as columns
          const { data: updatedBatch, error: updateErr } = await supabase
            .from("batches")
            .update({
              status: "Growing",
              status_id: statusId,
              phase,
              quantity: batchItem.quantity,
              initial_quantity: batchItem.quantity,
              location_id: batchItem.location_id,
              supplier_id: payload.supplier_id,
              planted_at: payload.delivery_date,
              ready_at: readyDateStr,
              supplier_batch_number: payload.supplier_reference ?? "",
              log_history: [...existingHistory, logEntry],
              updated_at: new Date().toISOString(),
            })
            .eq("id", batchItem.incoming_batch_id)
            .select("*")
            .single();

          if (updateErr) {
            errors.push(`Failed to update batch ${batchItem.incoming_batch_id}: ${updateErr.message}`);
            continue;
          }

          // Log event
          await supabase.from("batch_events").insert({
            org_id: orgId,
            batch_id: batchItem.incoming_batch_id,
            type: "STOCK_RECEIVED",
            by_user_id: user.id,
            payload: {
              deliveryDate: payload.delivery_date,
              supplierId: payload.supplier_id,
              supplierReference: payload.supplier_reference,
              quantity: batchItem.quantity,
              qualityRating: batchItem.quality_rating ?? payload.overall_quality,
              pestOrDisease: batchItem.pest_or_disease,
              notes: batchItem.notes,
            },
          });

          // Consume materials if size_id is provided
          let materialConsumption = null;
          try {
            const consumptionResult = await consumeMaterialsForBatch(
              supabase,
              orgId,
              user.id,
              batchItem.incoming_batch_id,
              incomingBatch.batch_number,
              batchItem.size_id,
              batchItem.quantity,
              batchItem.location_id,
              true // allowPartial
            );
            materialConsumption = {
              success: consumptionResult.success,
              transactionCount: consumptionResult.transactions.length,
              shortages: consumptionResult.shortages,
            };
          } catch (consumeErr) {
            console.error("[check-in-multi] Material consumption failed for existing batch:", consumeErr);
          }

          results.push({ ...updatedBatch, materialConsumption });
        } else {
          // Create new batch
          // Note: quality_rating and pest_or_disease are stored in log_history, not as columns
          const phaseCounter = PHASE_COUNTER[phase] ?? 2;
          const batchNumber = await nextBatchNumber(phaseCounter);

          const { data: batch, error } = await supabase
            .from("batches")
            .insert({
              org_id: orgId,
              batch_number: batchNumber,
              phase,
              plant_variety_id: batchItem.plant_variety_id,
              size_id: batchItem.size_id,
              supplier_id: payload.supplier_id,
              location_id: batchItem.location_id,
              status: "Growing",
              status_id: statusId,
              quantity: batchItem.quantity,
              initial_quantity: batchItem.quantity,
              unit: "plants",
              planted_at: payload.delivery_date,
              ready_at: readyDateStr,
              supplier_batch_number: payload.supplier_reference ?? "",
              log_history: [logEntry],
            })
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
            type: "CHECK_IN",
            by_user_id: user.id,
            payload: {
              deliveryDate: payload.delivery_date,
              supplierId: payload.supplier_id,
              supplierReference: payload.supplier_reference,
              quantity: batchItem.quantity,
              qualityRating: batchItem.quality_rating ?? payload.overall_quality,
              pestOrDisease: batchItem.pest_or_disease,
              notes: batchItem.notes,
            },
          });

          // Consume materials for new batch
          let materialConsumption = null;
          try {
            const consumptionResult = await consumeMaterialsForBatch(
              supabase,
              orgId,
              user.id,
              batch.id,
              batch.batch_number,
              batchItem.size_id,
              batchItem.quantity,
              batchItem.location_id,
              true // allowPartial
            );
            materialConsumption = {
              success: consumptionResult.success,
              transactionCount: consumptionResult.transactions.length,
              shortages: consumptionResult.shortages,
            };
          } catch (consumeErr) {
            console.error("[check-in-multi] Material consumption failed for new batch:", consumeErr);
          }

          results.push({ ...batch, materialConsumption });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing batch: ${message}`);
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
    const message = error instanceof Error ? error.message : "Failed to check in batches";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
