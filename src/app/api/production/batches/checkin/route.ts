import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { CheckInInputSchema } from "@/lib/production/schemas";
import { nextBatchNumber } from "@/server/numbering/batches";

const PhaseMap = { propagation: 1, plug: 2, potted: 3 } as const;

export async function POST(req: NextRequest) {
  try {
    const input = CheckInInputSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, cell_multiple")
      .eq("id", input.size_id)
      .single();
    if (sizeErr || !size) throw new Error("Invalid size");

    const units = input.containers * (size.cell_multiple ?? 1);
    const batchNumber = await nextBatchNumber(PhaseMap[input.phase]);

    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase: input.phase,                // production_phase enum
        plant_variety_id: input.plant_variety_id,
        size_id: input.size_id,
        location_id: input.location_id,
        supplier_id: input.supplier_id,
        status: "Growing",
        quantity: units,
        initial_quantity: units,
        unit: "plants",
        planted_at: input.incoming_date,
        supplier_batch_number: input.supplier_batch_number,
        log_history: [],
      })
      .select("*")
      .single();

    if (bErr || !batch) throw new Error(bErr?.message ?? "Batch insert failed");

    await supabase.from("batch_events").insert({
      batch_id: batch.id,
      org_id: orgId,
      type: "CHECKIN",
      by_user_id: user.id,
      payload: {
        containers: input.containers,
        computed_units: units,
        supplier_id: input.supplier_id,
        supplier_batch_number: input.supplier_batch_number,
        incoming_date: input.incoming_date,
        quality_rating: input.quality_rating ?? null,
        pest_or_disease: input.pest_or_disease ?? false,
        notes: input.notes ?? null,
        photo_urls: input.photo_urls ?? [],
      },
    });

    // Supplier passport (current)
    // Producer code & country from supplier
    const { data: supplier, error: sErr } = await supabase
      .from("suppliers")
      .select("producer_code, country_code, name")
      .eq("id", input.supplier_id)
      .single();
    if (sErr || !supplier) throw new Error("Supplier not found");

    await supabase.from("batch_passports").insert({
      batch_id: batch.id,
      org_id: orgId,
      passport_type: "supplier",
      operator_reg_no: supplier.producer_code ?? "IE2727",
      traceability_code: input.supplier_batch_number,
      origin_country: supplier.country_code ?? "IE",
      raw_label_text: null,
      images: (input.photo_urls ?? []).length ? { photos: input.photo_urls } : null,
      created_by_user_id: user.id,
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (e: any) {
    console.error("[batches/checkin] error", e);
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 400;
    return NextResponse.json({ error: e?.message ?? "Invalid request" }, { status });
  }
}
