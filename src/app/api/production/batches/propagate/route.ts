import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { PropagationInputSchema } from "@/lib/production/schemas";
import { nextBatchNumber } from "@/server/numbering/batches";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = PropagationInputSchema.parse(body);

    const { supabase, orgId, user } = await getUserAndOrg();
    // Fetch size.multiple to compute units
    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, cell_multiple")
      .eq("id", input.size_id)
      .single();
    if (sizeErr || !size) throw new Error("Invalid size selection");

    const units = input.containers * (size.cell_multiple ?? 1);
    const batchNumber = await nextBatchNumber(1);

    // Transaction via PostgREST cannot multi; use RPC/edge func in future.
    // Here we rely on row-level consistency: insert batch; if event/passport fail, we clean up.
    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase: "propagation",             // production_phase enum
        plant_variety_id: input.plant_variety_id,
        size_id: input.size_id,
        location_id: input.location_id,
        status: "Growing",                // production_status enum
        quantity: units,
        initial_quantity: units,
        unit: "plants",
        planted_at: input.planted_at ?? null,
        supplier_batch_number: "",        // internal
        log_history: [],
      })
      .select("*")
      .single();

    if (bErr || !batch) throw new Error(bErr?.message ?? "Batch insert failed");

    // Event
    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "PROPAGATE",
      by_user_id: user.id,
      payload: {
        containers: input.containers,
        computed_units: units,
        notes: input.notes ?? null,
      },
    });

    // Internal passport (IE2727 / IE)
    await supabase.from("batch_passports").insert({
      batch_id: batch.id,
      org_id: orgId,
      passport_type: "internal",
      operator_reg_no: "IE2727",   // defaults per spec
      traceability_code: batch.batch_number,
      origin_country: "IE",
      created_by_user_id: user.id,
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (e: any) {
    console.error("[batches/propagate] error", e);
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 400;
    return NextResponse.json({ error: e?.message ?? "Invalid request" }, { status });
  }
}
