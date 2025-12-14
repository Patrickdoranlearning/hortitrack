import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { nextBatchNumber } from "@/server/numbering/batches";

const DateOnly = /^\d{4}-\d{2}-\d{2}$/;

const CheckInSchema = z.object({
  plant_variety_id: z.string().uuid(),
  size_id: z.string().uuid(),
  phase: z.enum(["propagation", "plug", "potted"]),
  supplier_id: z.string().uuid().nullable().optional(),
  location_id: z.string().uuid(),
  incoming_date: z.string().regex(DateOnly, "Use YYYY-MM-DD"),
  containers: z.number().int().positive(),
  supplier_batch_number: z.string().min(1).max(120),
  quality_rating: z.number().int().min(1).max(6).optional(),
  pest_or_disease: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  passport_override: z
    .object({
      operator_reg_no: z.string().optional(),
      origin_country: z.string().optional(),
      traceability_code: z.string().optional(),
    })
    .optional(),
  // Optional: if actualizing an incoming batch
  incoming_batch_id: z.string().uuid().optional(),
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
    const payload = CheckInSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Get size info to calculate units
    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, container_type, cell_multiple")
      .eq("id", payload.size_id)
      .single();

    if (sizeErr || !size) {
      return NextResponse.json({ error: "Invalid size" }, { status: 400 });
    }

    const cellMultiple = Number(size.cell_multiple ?? 1) || 1;
    const totalUnits = payload.containers * cellMultiple;

    // Calculate ready date (21 days from incoming)
    const incomingDate = new Date(payload.incoming_date);
    const readyDate = new Date(incomingDate);
    readyDate.setDate(readyDate.getDate() + 21);

    // If this is actualizing an incoming batch, update that batch instead
    if (payload.incoming_batch_id) {
      // Verify the incoming batch exists and belongs to this org
      const { data: incomingBatch, error: incomingErr } = await supabase
        .from("batches")
        .select("*")
        .eq("id", payload.incoming_batch_id)
        .eq("org_id", orgId)
        .single();

      if (incomingErr || !incomingBatch) {
        return NextResponse.json({ error: "Incoming batch not found" }, { status: 404 });
      }

      if (incomingBatch.status !== "Incoming") {
        return NextResponse.json(
          { error: "Only incoming batches can be checked in this way" },
          { status: 400 }
        );
      }

      // Resolve status_id for "Growing"
      const statusId = await resolveStatusId(supabase, orgId, "Growing");

      // Build log entry
      const logEntry = {
        type: "stock_received",
        timestamp: new Date().toISOString(),
        userId: user.id,
        previousStatus: incomingBatch.status,
        newStatus: "Growing",
        previousQuantity: incomingBatch.quantity,
        newQuantity: totalUnits,
        containers: payload.containers,
        locationId: payload.location_id,
        qualityRating: payload.quality_rating,
        pestOrDisease: payload.pest_or_disease,
        notes: payload.notes,
      };

      const existingHistory = Array.isArray(incomingBatch.log_history)
        ? incomingBatch.log_history
        : [];

      // Update the incoming batch
      const { data: updatedBatch, error: updateErr } = await supabase
        .from("batches")
        .update({
          status: "Growing",
          status_id: statusId,
          phase: payload.phase,
          quantity: totalUnits,
          initial_quantity: totalUnits,
          location_id: payload.location_id,
          planted_at: payload.incoming_date,
          ready_at: readyDate.toISOString().slice(0, 10),
          supplier_batch_number: payload.supplier_batch_number,
          quality_rating: payload.quality_rating,
          pest_or_disease: payload.pest_or_disease,
          log_history: [...existingHistory, logEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.incoming_batch_id)
        .select("*")
        .single();

      if (updateErr) {
        console.error("[check-in] Update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // Log event
      await supabase.from("batch_events").insert({
        org_id: orgId,
        batch_id: payload.incoming_batch_id,
        type: "STOCK_RECEIVED",
        by_user_id: user.id,
        payload: {
          containers: payload.containers,
          totalUnits,
          qualityRating: payload.quality_rating,
          pestOrDisease: payload.pest_or_disease,
          notes: payload.notes,
          incomingDate: payload.incoming_date,
        },
      });

      return NextResponse.json({ batch: updatedBatch }, { status: 200 });
    }

    // Create new batch
    const phaseCounter = PHASE_COUNTER[payload.phase] ?? 2;
    const batchNumber = await nextBatchNumber(phaseCounter);

    // Resolve status_id for "Growing"
    const statusId = await resolveStatusId(supabase, orgId, "Growing");

    // Build log entry
    const logEntry = {
      type: "check_in",
      timestamp: new Date().toISOString(),
      userId: user.id,
      containers: payload.containers,
      totalUnits,
      qualityRating: payload.quality_rating,
      pestOrDisease: payload.pest_or_disease,
      notes: payload.notes,
    };

    // Build passport data if provided
    const passportOverride = payload.passport_override;

    const { data: batch, error } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase: payload.phase,
        plant_variety_id: payload.plant_variety_id,
        size_id: payload.size_id,
        supplier_id: payload.supplier_id ?? null,
        location_id: payload.location_id,
        status: "Growing",
        status_id: statusId,
        quantity: totalUnits,
        initial_quantity: totalUnits,
        unit: "plants",
        planted_at: payload.incoming_date,
        ready_at: readyDate.toISOString().slice(0, 10),
        supplier_batch_number: payload.supplier_batch_number,
        quality_rating: payload.quality_rating,
        pest_or_disease: payload.pest_or_disease ?? false,
        log_history: [logEntry],
        // Passport override fields if provided
        passport_operator_reg: passportOverride?.operator_reg_no,
        passport_origin_country: passportOverride?.origin_country,
        passport_traceability: passportOverride?.traceability_code,
      })
      .select("*")
      .single();

    if (error || !batch) {
      console.error("[check-in] Insert error:", error);
      return NextResponse.json(
        { error: error?.message ?? "Failed to create batch" },
        { status: 500 }
      );
    }

    // Log event
    await supabase.from("batch_events").insert({
      org_id: orgId,
      batch_id: batch.id,
      type: "CHECK_IN",
      by_user_id: user.id,
      payload: {
        containers: payload.containers,
        totalUnits,
        qualityRating: payload.quality_rating,
        pestOrDisease: payload.pest_or_disease,
        notes: payload.notes,
        incomingDate: payload.incoming_date,
      },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error: any) {
    console.error("[check-in] Error:", error);
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error?.message ?? "Failed to check in batch";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
