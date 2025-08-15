// Ensure Node runtime (Admin SDK won't work on Edge)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { FieldValue } from "firebase-admin/firestore";
import { mapError } from "@/lib/validation";

// ---------- PATCH (update) ----------
const UpdateBatchSchema = z
  .object({
    category: z.string().optional(),
    plantFamily: z.string().optional(),
    plantVariety: z.string().optional(),
    plantingDate: z.string().optional(), // ISO
    quantity: z.number().int().nonnegative().optional(),
    status: z
      .enum([
        "Propagation",
        "Plugs/Liners",
        "Potted",
        "Ready for Sale",
        "Looking Good",
        "Archived",
      ])
      .optional(),
    location: z.string().optional(),
    size: z.string().optional(),
    supplier: z.string().nullable().optional(),
    growerPhotoUrl: z.string().nullable().optional(),
    salesPhotoUrl: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(req: Request, ctx: { params: { batchId: string } }) {
  try {
    const { batchId } = ctx.params;
    const json = await req.json();
    const parsed = UpdateBatchSchema.parse(json);

    const ref = adminDb.collection("batches").doc(batchId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ id: batchId }, { status: 200 });
  } catch (e: any) {
    console.error("PATCH /api/batches/[id] error:", e);
    const { status, body } = mapError(e);
    return NextResponse.json(body, { status });
  }
}

// ---------- DELETE (cascade subcollections) ----------
async function deleteDocWithSubcollections(
  docRef: FirebaseFirestore.DocumentReference
) {
  // delete subcollections (e.g., "logs") in chunks
  const subcols = await docRef.listCollections();
  for (const col of subcols) {
    const docs = await col.listDocuments();
    // chunk to stay under 500 ops per batch
    for (let i = 0; i < docs.length; i += 450) {
      const slice = docs.slice(i, i + 450);
      const b = adminDb.batch();
      slice.forEach((d) => b.delete(d));
      await b.commit();
    }
  }
  // finally delete the batch doc
  await docRef.delete();
}

export async function DELETE(_req: Request, ctx: { params: { batchId: string } }) {
  try {
    const { batchId } = ctx.params;
    const ref = adminDb.collection("batches").doc(batchId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    await deleteDocWithSubcollections(ref);
    return NextResponse.json({ id: batchId }, { status: 200 });
  } catch (e: any) {
    console.error("DELETE /api/batches/[id] error:", e);
    const { status, body } = mapError(e);
    return NextResponse.json(body, { status });
  }
}
