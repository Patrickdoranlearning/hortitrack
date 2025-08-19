// src/app/api/batches/[id]/passport/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";

type ComputedPassport = {
  batchId: string;
  aFamily: string | null;
  bProducerCode: string | null;
  cBatchNumber: string;
  dCountryCode: string | null;
  warnings: string[];
};

async function getBatchWithSupplier(batchId: string): Promise<any | null> {
    if (!batchId || typeof batchId !== 'string') {
        return null;
    }
    const batchRef = adminDb.collection('batches').doc(batchId);
    const batchSnap = await batchRef.get();

    if (!batchSnap.exists) {
        return null;
    }
    const batch = { id: batchSnap.id, ...batchSnap.data() };

    if (batch.supplier) {
        // Assuming supplier is stored as a string name.
        // If it's a reference, this logic would change.
        const supplierSnap = await adminDb.collection('suppliers').where('name', '==', batch.supplier).limit(1).get();
        if (!supplierSnap.empty) {
            batch.supplierData = { id: supplierSnap.docs[0].id, ...supplierSnap.docs[0].data() };
        }
    }
    return batch;
}


async function computePassportForBatch(batchId: string): Promise<ComputedPassport> {
  const batch = await getBatchWithSupplier(batchId);
  if (!batch) {
    throw new Error("Batch not found");
  }

  const warnings: string[] = [];

  const aFamily = batch.plantFamily ?? null;
  const cBatchNumber = batch.batchNumber ?? batch.id;
  const bProducerCode = batch.supplierData?.producerCode ?? null;
  const dCountryCode = batch.supplierData?.countryCode ?? null;

  if (batch.sourceType === "Purchase") {
    if (!bProducerCode) warnings.push("Supplier producer code (B) missing.");
    if (!dCountryCode) warnings.push("Supplier country code (D) missing.");
  }
  if (!aFamily) warnings.push("Family (A) missing on batch.");
  if (!cBatchNumber) warnings.push("Batch number (C) missing on batch.");

  return {
    batchId,
    aFamily,
    bProducerCode,
    cBatchNumber: String(cBatchNumber),
    dCountryCode,
    warnings,
  };
}

export async function GET(_: NextRequest, { params }: { params: { batchId: string }}) {
  try {
    const batchId = params.batchId;
    if (!batchId) {
        return NextResponse.json({ error: "Batch ID is required." }, { status: 400 });
    }
    const data = await computePassportForBatch(params.batchId);
    return NextResponse.json(declassify(data), { status: 200 });
  } catch (e: any) {
    const status = e.message.includes("Not found") ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
