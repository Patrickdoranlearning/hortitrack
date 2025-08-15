
// src/app/api/batches/[batchId]/allocate/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import * as admin from 'firebase-admin';

/**
 * Payload
 * {
 *   actions: string[],                 // e.g. ["Move","Spaced","Dumped"]
 *   note?: string,
 *   photoUrls?: string[],
 *   lostQuantity?: number,             // reduce stock
 *   lossReason?: string,
 *   split?: boolean,                   // force split even if full-qty move
 *   allocations?: Array<{              // destinations (can be empty)
 *     quantity: number,
 *     location: string,
 *     size?: string,
 *     status?: "Propagation" | "Plugs/Liners" | "Potted" | "Ready for Sale" | "Looking Good" | "Archived",
 *     supplier?: string
 *   }>
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;
    const body = await req.json();

    const {
      actions = [],
      note,
      photoUrls = [],
      lostQuantity = 0,
      lossReason,
      split = false,
      allocations = [],
    } = body || {};

    if (!Array.isArray(actions)) {
      return NextResponse.json({ error: "actions must be an array" }, { status: 400 });
    }
    if (!Array.isArray(allocations)) {
      return NextResponse.json({ error: "allocations must be an array" }, { status: 400 });
    }

    const batchRef = db.collection("batches").doc(batchId);
    const countersRef = db.collection("counters").doc("batches");

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(batchRef);
      if (!snap.exists) throw new Error("Batch not found");

      const batch = snap.data() as any;
      const now = admin.firestore.FieldValue.serverTimestamp();

      const currentQty: number = Number(batch.quantity || 0);
      const lossQty = Math.max(0, Number(lostQuantity || 0));

      const moveQtyTotal = allocations.reduce((s: number, a: any) => s + Math.max(0, Number(a.quantity || 0)), 0);

      if (lossQty + moveQtyTotal > currentQty) {
        throw new Error(
          `Allocated (${moveQtyTotal}) + lost (${lossQty}) exceeds current qty (${currentQty}).`
        );
      }

      // Helper: get a new batch number (simple counter in /counters/batches)
      const nextBatchNumber = async () => {
        const c = await tx.get(countersRef);
        let n = 1000;
        if (c.exists) {
          const cur = Number(c.data()?.current ?? 1000);
          n = cur + 1;
          tx.update(countersRef, { current: n });
        } else {
          tx.set(countersRef, { current: n });
        }
        return String(n);
      };

      const logs: any[] = [];
      const created: Array<{ id: string; batchNumber: string }> = [];
      let remaining = currentQty;

      // Apply LOSS
      if (lossQty > 0) {
        remaining -= lossQty;
        logs.push({
          type: "Loss",
          quantity: lossQty,
          reason: lossReason || "unspecified",
          actions,
          note: note || null,
          photoUrls,
          at: now,
        });
      }

      // Create allocations (split/move/space)
      // Rule:
      // - If only one allocation equals full remaining qty and split===false,
      //   just update the original batch (no new docs).
      // - Otherwise, create new batches for each allocation and decrement original.
      const singleFullMove =
        allocations.length === 1 &&
        Number(allocations[0]?.quantity || 0) === remaining &&
        split === false;

      if (allocations.length > 0) {
        if (singleFullMove) {
          const a = allocations[0];
          tx.update(batchRef, {
            location: a.location || batch.location,
            size: a.size || batch.size,
            status: a.status || batch.status,
            supplier: a.supplier ?? batch.supplier ?? null,
            updatedAt: now,
          });

          logs.push({
            type: "Move",
            to: { location: a.location, size: a.size || batch.size },
            quantity: remaining,
            actions,
            note: note || null,
            photoUrls,
            at: now,
          });
        } else {
          // create child batches for each allocation
          for (const a of allocations) {
            const q = Math.max(0, Number(a.quantity || 0));
            if (!q) continue;
            if (q > remaining) throw new Error("Allocation exceeds remaining quantity.");
            remaining -= q;

            const newNumber = await nextBatchNumber();
            const childRef = db.collection("batches").doc();
            tx.set(childRef, {
              plantVariety: batch.plantVariety,
              plantFamily: batch.plantFamily,
              category: batch.category,
              plantingDate: batch.plantingDate, // keep same
              initialQuantity: q,
              quantity: q,
              status: a.status || batch.status,
              size: a.size || batch.size,
              supplier: a.supplier ?? batch.supplier ?? null,
              location: a.location,
              createdAt: now,
              updatedAt: now,
              batchNumber: newNumber,
              plantVarietyId: batch.plantVarietyId ?? null,
              logHistory: [
                {
                  type: "Created (Split)",
                  fromBatchId: batchRef.id,
                  fromBatchNumber: batch.batchNumber ?? null,
                  quantity: q,
                  actions,
                  note: note || null,
                  photoUrls,
                  at: now,
                },
              ],
            });

            created.push({ id: childRef.id, batchNumber: newNumber });
          }

          logs.push({
            type: "Split",
            destinations: allocations.map((a: any) => ({
              location: a.location,
              size: a.size || batch.size,
              quantity: Number(a.quantity || 0),
            })),
            actions,
            note: note || null,
            photoUrls,
            at: now,
          });

          // update original quantity to remaining (and keep its current location/size)
          tx.update(batchRef, {
            quantity: remaining,
            updatedAt: now,
          });
        }
      }

      // If no allocations, we still append the loss/spacing/other logs
      if (allocations.length === 0) {
        logs.push({
          type: "Action",
          actions,
          note: note || null,
          photoUrls,
          at: now,
        });

        tx.update(batchRef, {
          quantity: remaining,
          updatedAt: now,
        });
      }

      // append logs to original
      tx.update(batchRef, {
        logHistory: admin.firestore.FieldValue.arrayUnion(...logs),
      });

      return {
        ok: true,
        created,
        remaining,
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("allocate/split error:", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

    