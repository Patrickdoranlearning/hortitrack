
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserAndOrg } from "@/server/auth/org";
import { CheckInInputSchema } from "@/lib/domain/batch";
import { nextBatchNumber } from "@/server/numbering/batches";
import { resolveProductionStatus } from "@/server/batches/service";

const PhaseMap = { propagation: 1, plug: 2, potted: 3 } as const;

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const input = CheckInInputSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Resolve status_id
    const statusOption = await resolveProductionStatus(supabase, orgId, "Growing");

    // derive units
    const { data: size, error: sizeErr } = await supabase
      .from("plant_sizes")
      .select("id, cell_multiple")
      .eq("id", input.size_id)
      .single();
    if (sizeErr || !size) throw new Error("Invalid size");

    const units = input.containers * (size.cell_multiple ?? 1);
    const batchNumber = await nextBatchNumber(PhaseMap[input.phase]);

    // 1) batch
    const { data: batch, error: bErr } = await supabase
      .from("batches")
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        phase: input.phase,
        plant_variety_id: input.plant_variety_id,
        size_id: input.size_id,
        location_id: input.location_id,
        supplier_id: input.supplier_id,
        status: statusOption.system_code,
        status_id: statusOption.id,
        quantity: units,
        initial_quantity: units,
        planted_at: input.incoming_date,
        supplier_batch_number: input.supplier_batch_number,
      })
      .select("*")
      .single();
    if (bErr || !batch) throw new Error(bErr?.message ?? "Batch insert failed");

    // 2) event
    const { error: eErr } = await supabase.from("batch_events").insert({
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
      request_id: requestId,
    });
    if (eErr) {
      await supabase.from("batches").delete().eq("id", batch.id);
      throw new Error(`Event insert failed: ${eErr.message}`);
    }

    // 3) passport from supplier defaults
    const { data: supplier, error: sErr } = await supabase
      .from("suppliers")
      .select("producer_code, country_code")
      .eq("id", input.supplier_id)
      .single();
    if (sErr || !supplier) {
      await supabase.from("batch_events").delete().eq("batch_id", batch.id);
      await supabase.from("batches").delete().eq("id", batch.id);
      throw new Error("Supplier not found");
    }
    
    // Get org defaults for passport (dynamic, not hardcoded!)
    const { data: org } = await supabase
      .from("organizations")
      .select("producer_code, country_code")
      .eq("id", orgId)
      .single();
    
    const operator_reg_no =
      input.passport_override?.operator_reg_no ??
      supplier.producer_code ?? 
      org?.producer_code ?? 
      "UNKNOWN";
    const origin_country =
      input.passport_override?.origin_country ??
      supplier.country_code ?? 
      org?.country_code ?? 
      "IE";
    const traceability_code =
      input.passport_override?.traceability_code ??
      input.supplier_batch_number;


    const { error: pErr } = await supabase.from("batch_passports").insert({
      batch_id: batch.id,
      org_id: orgId,
      passport_type: "supplier",
      operator_reg_no,
      traceability_code,
      origin_country,
      images: (input.photo_urls ?? []).length ? { photos: input.photo_urls } : null,
      created_by_user_id: user.id,
      request_id: requestId,
    });
    if (pErr) {
      await supabase.from("batch_events").delete().eq("batch_id", batch.id);
      await supabase.from("batches").delete().eq("id", batch.id);
      throw new Error(`Passport insert failed: ${pErr.message}`);
    }

    return NextResponse.json({ batch, requestId }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status =
      /Unauthenticated/i.test(message) ? 401 :
      /parse|invalid/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
