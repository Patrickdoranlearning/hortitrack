import { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { ok, fail } from "@/server/utils/envelope";
import { withIdempotency } from "@/server/utils/idempotency";
import { FieldValue } from "firebase-admin/firestore";

const Dump = z.object({
  batchId: z.string(),
  quantity: z.number().int().positive(),
  reason: z.string().min(2),
});

export async function POST(req: NextRequest) {
  try {
    const input = Dump.parse(await req.json());
    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      const out = await adminDb.runTransaction(async (trx) => {
        const ref = adminDb.collection("batches").doc(input.batchId);
        const snap = await trx.get(ref);
        if (!snap.exists) throw new Error("Batch not found");
        const b = snap.data() as any;
        const after = (b.quantity ?? 0) - input.quantity;
        if (after < 0) throw new Error("Quantity exceeds stock level");

        trx.update(ref, { quantity: after, updatedAt: new Date().toISOString() });
        trx.update(ref, {
          logHistory: FieldValue.arrayUnion({ type: "LOSS", note:`Dumped ${input.quantity} units. Reason: ${input.reason}`, qty: -input.quantity, reason: input.reason, date: new Date().toISOString() })
        } as any);

        // Loss event collection (optional)
        const lossRef = adminDb.collection("lossEvents").doc();
        trx.set(lossRef, { batchId: ref.id, quantity: input.quantity, reason: input.reason, at: new Date().toISOString() });

        return { ok: true };
      });
      return { status: 201, body: out };
    });
    return ok(result.body, result.status);
  } catch (e:any) {
    if (e?.issues) return fail(422, "INVALID_INPUT", "Invalid input", e.issues);
    return fail(400, "DUMP_FAILED", e?.message ?? "Dump failed");
  }
}
