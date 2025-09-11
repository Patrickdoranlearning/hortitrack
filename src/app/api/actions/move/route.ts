import { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { ok, fail } from "@/server/utils/envelope";
import { withIdempotency } from "@/server/utils/idempotency";
import { FieldValue } from "firebase-admin/firestore";
import { generateNextBatchId } from "@/server/batches/nextId";

const Move = z.object({
  batchId: z.string(),
  destination: z.string(),
  quantity: z.number().int().nonnegative().optional(), // absent => move all
  spaced: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const input = Move.parse(await req.json());
    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      const out = await adminDb.runTransaction(async (trx) => {
        const ref = adminDb.collection("batches").doc(input.batchId);
        const snap = await trx.get(ref);
        if (!snap.exists) throw new Error("Batch not found");
        const b = snap.data() as any;
        const all = (b.quantity ?? 0);
        const qty = input.quantity ?? all;

        if (qty <= 0 || qty > all) throw new Error("Invalid move quantity");

        if (qty === all) {
          // Move entire batch
          trx.update(ref, { location: input.destination, updatedAt: new Date().toISOString() });
          trx.update(ref, { logHistory: FieldValue.arrayUnion({ type: "Move", note: `Moved to ${input.destination}`, qty, to: input.destination, spaced: !!input.spaced, date: new Date().toISOString() }) } as any);
          return { movedAll: true, newBatchId: null };
        }

        // Partial move => create child
        const { id: batchNumber } = await generateNextBatchId({ when: new Date() });
        const childRef = adminDb.collection("batches").doc();
        trx.set(childRef, {
          ...b,
          batchNumber,
          location: input.destination,
          quantity: qty,
          initialQuantity: qty,
          transplantedFrom: ref.id,
          ancestryFromId: ref.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        trx.update(ref, { quantity: all - qty, updatedAt: new Date().toISOString() });
        trx.update(ref, { logHistory: FieldValue.arrayUnion({ type: "Move-Partial", note: `Moved ${qty} units to ${input.destination}`, qty, to: input.destination, spaced: !!input.spaced, date: new Date().toISOString() }) } as any);

        return { movedAll: false, newBatchId: childRef.id };
      });
      return { status: 201, body: out };
    });
    return ok(result.body, result.status);
  } catch (e:any) {
    if (e?.issues) return fail(422, "INVALID_INPUT", "Invalid input", e.issues);
    return fail(400, "MOVE_FAILED", e?.message ?? "Move failed");
  }
}
