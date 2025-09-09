import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerClient } from "@/server/db/supabaseServer";
import { PropagationInputSchema } from "@/lib/production/schemas";
import { nextBatchNumber } from "@/server/numbering/batches";

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = await req.json();
    const input = PropagationInputSchema.parse(body);

    const { supabase, orgId, user } = await getUserAndOrg();

    // Fetch size.multiple to compute plant units from container count
    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, cell_multiple")
      .eq("id", input.size_id)
      .single();
    if (sizeErr || !size) throw new Error("Invalid size selection");

    const units = input.containers * (size.cell_multiple ?? 1);
    const batchNumber = await nextBatchNumber(1); // 1 = propagation

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
        status: "Growing",                  // enum production_status
        quantity: units,
        initial_quantity: units,
        planted_at: input.planted_at ?? null,
        supplier_batch_number: "",          // internal propagation
      })
      .select("*")
      .single();

    if (bErr || !batch) throw new Error(bErr?.message ?? "Batch insert failed");

    // Log event
    const { error: eErr } = await supabase.from("batch_events").insert({
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
    });
    if (eErr) {
      // cleanup to avoid orphan
      await supabase.from("batches").delete().eq("id", batch.id);
      throw new Error(`Event insert failed: ${eErr.message}`);
    }

    // Create internal passport (defaults)
    const { error: pErr } = await supabase.from("batch_passports").insert({
      batch_id: batch.id,
      org_id: orgId,
      passport_type: "internal",
      operator_reg_no: "IE2727",          // default internal operator
      traceability_code: batch.batch_number,
      origin_country: "IE",
      created_by_user_id: user.id,
      request_id: requestId,
    });
    if (pErr) {
      await supabase.from("batch_events").delete().eq("batch_id", batch.id);
      await supabase.from("batches").delete().eq("id", batch.id);
      throw new Error(`Passport insert failed: ${pErr.message}`);
    }

    return NextResponse.json({ batch, requestId }, { status: 201 });
  } catch (e: any) {
    console.error("[propagate]", { requestId, error: e?.message });
    const status =
      /Unauthenticated/i.test(e?.message) ? 401 :
      /parse|invalid/i.test(e?.message) ? 400 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error", requestId }, { status });
  }
}
