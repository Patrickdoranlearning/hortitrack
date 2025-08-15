import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { buildBatchLabelZpl } from "@/server/labels/build-batch-label";

function declassify(value: any): any {
  if (value == null) return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(declassify);
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = declassify(v);
    return out;
  }
  return value;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const doc = await adminDb.collection("batches").doc(params.id).get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data = declassify(doc.data() || {});
  const zpl = buildBatchLabelZpl({
    id: doc.id,
    batchNumber: data.batchNumber,
    plantVariety: data.plantVariety,
    plantFamily: data.plantFamily,
    size: data.size,
    initialQuantity: data.initialQuantity ?? data.quantity ?? 0,
  });
  return new NextResponse(zpl, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
