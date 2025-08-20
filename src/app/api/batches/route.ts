
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { z } from "zod";
import { BatchSchema } from "@/lib/types";
import { declassify } from "@/server/utils/declassify";
import { toMessage } from "@/lib/errors";
import { generateNextBatchId, type BatchPhase } from "@/server/batches/nextId";

const CreateBatch = BatchSchema.pick({
  // batchNumber is optional in input; we’ll assign if missing
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
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Try parse, but allow missing batchNumber on input
    const maybe = CreateBatch.partial({ batchNumber: true }).parse(body);
    const batchNumber =
      typeof maybe.batchNumber === "string" && maybe.batchNumber.length > 0
        ? maybe.batchNumber
        : (await generateNextBatchId((body?.phase as BatchPhase) ?? "POTTING")).id;
    const data = CreateBatch.parse({ ...maybe, batchNumber });

    const ref = adminDb.collection("batches").doc();
    await ref.set({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const snap = await ref.get();
    return NextResponse.json({ id: ref.id, ...declassify(snap.data()) }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      const msg = toMessage(e.errors); // Convert Zod errors to a single message
      return NextResponse.json({ error: msg, issues: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: toMessage(e) }, { status: 500 });
  }
}
