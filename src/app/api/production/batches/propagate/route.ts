
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserAndOrg } from "@/server/auth/org";
import { PropagationInputSchema } from "@/lib/domain/batch";
import { nextBatchNumber } from "@/server/numbering/batches";
import { ensureInternalSupplierId } from "@/server/suppliers/getInternalSupplierId";
import { resolveProductionStatus } from "@/server/batches/service";
import { consumeMaterialsForBatch } from "@/server/materials/consumption";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { logger } from "@/server/utils/logger";

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = await req.json();
    const input = PropagationInputSchema.parse(body);

    const { supabase, orgId, user } = await getUserAndOrg();

    // Rate limit: 30 propagations per minute per user (heavy operation)
    const rlKey = `batch:propagate:${requestKey(req, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 30 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests, please try again later", resetMs: rl.resetMs, requestId },
        { status: 429 }
      );
    }
    // Parallelize independent lookups for better performance
    const [
      internalSupplierId,
      statusOption,
      sizeResult,
      batchNumber,
      orgResult,
    ] = await Promise.all([
      ensureInternalSupplierId(supabase, orgId),
      resolveProductionStatus(supabase, orgId, "Propagation"),
      supabase
        .from("plant_sizes")
        .select("id, cell_multiple")
        .eq("id", input.size_id)
        .single(),
      nextBatchNumber(1, supabase, orgId), // 1 = propagation, pass client to avoid re-auth
      supabase
        .from("organizations")
        .select("producer_code, country_code")
        .eq("id", orgId)
        .single(),
    ]);

    const { data: size, error: sizeErr } = sizeResult;
    if (sizeErr || !size) throw new Error("Invalid size selection");

    const units = input.containers * (size.cell_multiple ?? 1);

    // Insert batch
    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase: "propagation",               // enum production_phase
        plant_variety_id: input.plant_variety_id,
        size_id: input.size_id,
        location_id: input.location_id,
        status: statusOption.system_code,   // e.g. "Growing"
        status_id: statusOption.id,
        quantity: units,
        initial_quantity: units,
        unit: "plants",
        planted_at: input.planted_at ?? null,
        supplier_id: internalSupplierId,
        supplier_batch_number: "",          // internal propagation
      })
      .select("*")
      .single();

    if (bErr || !batch) throw new Error(bErr?.message ?? "Batch insert failed");

    // Use org data from parallel fetch above
    const org = orgResult.data;

    // Parallelize event and passport inserts (both only need batch.id)
    const [eventResult, passportResult] = await Promise.all([
      supabase.from("batch_events").insert({
        batch_id: batch.id,
        org_id: orgId,
        type: "PROPAGATE",
        by_user_id: user.id,
        payload: {
          containers: input.containers,
          computed_units: units,
          notes: input.notes ?? null,
        },
        request_id: requestId,
      }),
      supabase.from("batch_passports").insert({
        batch_id: batch.id,
        org_id: orgId,
        passport_type: "internal",
        operator_reg_no: org?.producer_code ?? "UNKNOWN",
        traceability_code: batch.batch_number,
        origin_country: org?.country_code ?? "IE",
        created_by_user_id: user.id,
        request_id: requestId,
      }),
    ]);

    // Handle errors with cleanup
    if (eventResult.error || passportResult.error) {
      // Cleanup on failure
      await Promise.all([
        supabase.from("batch_events").delete().eq("batch_id", batch.id),
        supabase.from("batch_passports").delete().eq("batch_id", batch.id),
        supabase.from("batches").delete().eq("id", batch.id),
      ]);
      const errMsg = eventResult.error?.message || passportResult.error?.message;
      throw new Error(`Failed to create batch records: ${errMsg}`);
    }

    // Consume materials for propagation
    let materialConsumption = null;
    try {
      const consumptionResult = await consumeMaterialsForBatch(
        supabase,
        orgId,
        user.id,
        batch.id,
        batch.batch_number,
        input.size_id,
        units,
        input.location_id,
        true // allowPartial
      );
      materialConsumption = {
        success: consumptionResult.success,
        transactionCount: consumptionResult.transactions.length,
        shortages: consumptionResult.shortages,
      };
    } catch (consumeErr) {
      logger.production.error("Material consumption failed, rolling back batch creation", consumeErr);
      // ROLLBACK BATCH CREATION ON MATERIAL ERROR
      await Promise.all([
        supabase.from("batch_events").delete().eq("batch_id", batch.id),
        supabase.from("batch_passports").delete().eq("batch_id", batch.id),
        supabase.from("batches").delete().eq("id", batch.id),
      ]);
      throw consumeErr;
    }

    return NextResponse.json({ batch, requestId, materialConsumption }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status =
      /Unauthenticated/i.test(message) ? 401 :
      /parse|invalid/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
