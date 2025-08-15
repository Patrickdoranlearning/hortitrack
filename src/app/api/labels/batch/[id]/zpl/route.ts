
import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { buildBatchLabelZplLandscape } from "@/server/labels/build-batch-label";
import { declassify } from "@/server/utils/declassify";
import { encodeBatchDataMatrixPayload } from "@/server/labels/payload";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const doc = await adminDb.collection("batches").doc(params.id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data = declassify(doc.data() || {});
  
  const zpl = buildBatchLabelZplLandscape({
    batchNumber: data.batchNumber,
    variety: data.plantVariety,
    family: data.plantFamily,
    quantity: data.initialQuantity ?? data.quantity ?? 0,
    size: data.size,
    dataMatrixPayload: encodeBatchDataMatrixPayload({ id: doc.id, batchNumber: data.batchNumber }),
  });

  return new NextResponse(zpl, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
