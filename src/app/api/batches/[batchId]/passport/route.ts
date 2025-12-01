
// src/app/api/batches/[batchId]/passport/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ComputedPassport = {
  batchId: string;
  aFamily: string | null;
  bProducerCode: string | null;
  cBatchNumber: string;
  dCountryCode: string | null;
  warnings: string[];
};

function pick<T extends object, K extends keyof T>(obj: T | null | undefined, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {};
  if (!obj) return out;
  for (const k of keys) (out as any)[k] = (obj as any)[k] ?? null;
  return out;
}

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const batchId = params.batchId?.trim();
    if (!batchId) {
      return NextResponse.json({ error: "Batch ID is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .select(
        `
        id,
        batch_number,
        plant_varieties(name, family),
        supplier_id,
        suppliers (producer_code, country_code)
      `
      )
      .eq("id", batchId)
      .maybeSingle();

    if (batchErr) {
      console.error("[passport] batch fetch failed", batchErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    if (!batch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const aFamily =
      (batch.plant_varieties?.family ??
        batch.family ??
        batch.plantFamily ??
        null) as string | null;

    const cBatchNumber =
      (batch.batch_number ?? batch.batchNumber ?? batchId) as string;

    let bProducerCode: string | null = null;
    let dCountryCode: string | null = null;
    const warnings: string[] = [];

    const embeddedSupplier = batch.suppliers ?? null;
    if (embeddedSupplier) {
      const picked = pick(embeddedSupplier, ["producer_code", "country_code"]);
      bProducerCode = (picked as any).producer_code ?? null;
      dCountryCode = (picked as any).country_code ?? null;
    }

    if (!bProducerCode) warnings.push("Supplier producer code (B) missing; using default.");
    if (!dCountryCode) warnings.push("Supplier country code (D) missing; using default.");

    const fallbackProducer = process.env.DEFAULT_PRODUCER_CODE ?? "IE2727 Doran Nurseries Producer Code";
    const fallbackCountry = process.env.DEFAULT_COUNTRY_CODE ?? "IE";

    const computed: ComputedPassport = {
      batchId,
      aFamily,
      bProducerCode: bProducerCode ?? fallbackProducer,
      cBatchNumber,
      dCountryCode: dCountryCode ?? fallbackCountry,
      warnings,
    };

    return NextResponse.json(computed, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("passport_route_error", { message: e?.message });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
