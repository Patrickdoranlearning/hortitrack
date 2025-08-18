import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { z } from "zod";
import { BatchSchema } from "@/lib/types";
import { declassify } from "@/server/utils/declassify";

const CreateBatch = BatchSchema.pick({
  batchNumber: true,
  category: true,
  plantFamily: true,
  plantVariety: true,
  plantingDate: true,
  initialQuantity: true,
  quantity: true,
  status: true,
  location: true,
  locationId: true,
  size: true,
  supplierId: true,
  notes: true,
});

export async function GET() {
  try {
    const snap = await adminDb.collection("batches").orderBy("plantingDate", "desc").limit(100).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...declassify(d.data()) }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = CreateBatch.parse(body);
    const ref = await adminDb.collection("batches").add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const snap = await ref.get();
    return NextResponse.json({ id: ref.id, ...declassify(snap.data()) }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
