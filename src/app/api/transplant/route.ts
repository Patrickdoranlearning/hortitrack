import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import { withIdempotency } from "@/server/utils/idempotency";
import { ok, fail } from "@/server/utils/envelope";
import { FieldValue } from "firebase-admin/firestore";
import { generateNextBatchId } from "@/server/batches/nextId";

const Transplant = z.object({
  sources: z.array(z.object({
    batchId: z.string().min(1),
    cellsPerPot: z.number().int().positive().default(1),
    unitsUsed: z.number().int().nonnegative(),
  })).min(1).max(2),
  newBatch: z.object({
    batchNumber: z.string().optional(),
    plantVariety: z.string(),
    plantFamily: z.string(),
    size: z.string(),
    location: z.string(),
    quantity: z.number().int().positive(), // pots/trays produced
    status: z.string(),
    plantingDate: z.string(), // ISO
  }),
  archiveRemainder: z.boolean().optional(),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const input = Transplant.parse(await req.json());

    const result = await withIdempotency(req.headers.get("x-request-id"), async () => {
      const t = await adminDb.runTransaction(async (trx) => {
        // Decrement sources atomically; compute total cells consumed
        for (const s of input.sources) {
          const ref = adminDb.collection("batches").doc(s.batchId);
          const snap = await trx.get(ref);
          if (!snap.exists) throw new Error(`Source not found: ${s.batchId}`);
          const b = snap.data() as any;
          const after = Math.max(0, (b.quantity ?? 0) - s.unitsUsed);
          trx.update(ref, { quantity: after, updatedAt: new Date().toISOString() });
          // Log
          trx.update(ref, {
            logHistory: FieldValue.arrayUnion({
              action: "Transplant-Used",
              units: s.unitsUsed,
              date: new Date().toISOString(),
              note: `Used ${s.unitsUsed} units for transplant`,
            })
          } as any);
        }

        const { id: batchNumber } = await generateNextBatchId({ when: new Date(input.newBatch.plantingDate) });

        // Create new batch
        const newDocRef = adminDb.collection("batches").doc();
        const primary = input.sources[0]!.batchId;
        trx.set(newDocRef, {
          ...input.newBatch,
          batchNumber,
          initialQuantity: input.newBatch.quantity,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          transplantedFrom: primary,
          ancestryFromId: primary, // for ancestry walkers
        });

        // Optional: archive remainder for primary if requested
        if (input.archiveRemainder) {
          const pRef = adminDb.collection("batches").doc(primary);
          trx.update(pRef, { status: "Archived" });
        }

        return { id: newDocRef.id, batchNumber };
      });
      return { status: 201, body: t };
    });

    return ok(result.body, result.status);
  } catch (e:any) {
    if (e?.issues) return fail(422, "INVALID_INPUT", "Invalid input", e.issues);
    return fail(500, "SERVER_ERROR", e?.message ?? "Transplant failed");
  }
}
