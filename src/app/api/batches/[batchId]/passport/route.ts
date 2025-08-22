
// src/app/api/batches/[batchId]/passport/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";

type ComputedPassport = {
  batchId: string;
  aFamily: string | null;
  bProducerCode: string | null;
  cBatchNumber: string;
  dCountryCode: string | null;
  warnings: string[];
};

async function getBatchDoc(batchId: string) {
  const snap = await adminDb.collection("batches").doc(batchId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } as any : null;
}

async function getSupplierDoc(supplierId: string) {
  const snap = await adminDb.collection("suppliers").doc(supplierId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } as any : null;
}

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

    const batch = await getBatchDoc(batchId);
    if (!batch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const aFamily =
      (batch.family ?? batch.plantFamily ?? batch.varietyFamily ?? null) as string | null;

    const cBatchNumber =
      (batch.batch_number ?? batch.batchNumber ?? batchId) as string;

    let bProducerCode: string | null = null;
    let dCountryCode: string | null = null;
    const warnings: string[] = [];

    // embedded supplier support
    const embeddedSupplier = batch.supplier ?? batch.supplierData ?? null;
    if (embeddedSupplier) {
      const picked = pick(embeddedSupplier, ["producerCode", "countryCode"]);
      bProducerCode = (picked as any).producerCode ?? null;
      dCountryCode = (picked as any).countryCode ?? null;
    }

    // referenced supplier support
    const supplierId: string | null =
      (batch.supplier_id ?? batch.supplierId ?? null) as string | null;

    if ((!bProducerCode || !dCountryCode) && supplierId) {
      const supplier = await getSupplierDoc(supplierId);
      if (supplier) {
        bProducerCode = (supplier.producerCode ?? bProducerCode) ?? null;
        dCountryCode = (supplier.countryCode ?? dCountryCode) ?? null;
      }
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
