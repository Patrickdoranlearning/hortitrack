
import { db, FieldValue } from "@/lib/firebase-admin";
import { ActionInputSchema, type ActionInput } from "@/lib/actions/schema";

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function ensureIdempotent(actionId: string): Promise<boolean> {
  const ref = db.collection("actionDedup").doc(actionId);
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set({ createdAt: FieldValue.serverTimestamp() });
  return true;
}

async function logAction(payload: ActionInput) {
  await db.collection("actionLogs").add({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function applyBatchAction(raw: unknown): Promise<Result> {
  const parsed = ActionInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid action payload" };
  const action = parsed.data;

  const firstUse = await ensureIdempotent(action.actionId);
  if (!firstUse) return { ok: true, data: { idempotent: true } };

  try {
    switch (action.type) {
      case "MOVE": {
        const { batchIds, toLocationId, quantity } = action;
        for (const batchId of batchIds) {
          const ref = db.collection("batches").doc(batchId);
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error(`Batch ${batchId} not found`);
            const batch = snap.data() as any;
            const moveQty = quantity ?? batch.quantity;
            if (moveQty <= 0) throw new Error("Quantity must be > 0");
            if (moveQty > batch.quantity) throw new Error("Insufficient quantity");

            if (moveQty === batch.quantity) {
              tx.update(ref, {
                locationId: toLocationId,
                updatedAt: FieldValue.serverTimestamp(),
              });
            } else {
              tx.update(ref, {
                quantity: FieldValue.increment(-moveQty),
                updatedAt: FieldValue.serverTimestamp(),
              });
              const newRef = db.collection("batches").doc();
              tx.set(newRef, {
                ...batch,
                parentBatchId: batchId,
                locationId: toLocationId,
                quantity: moveQty,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          });
        }
        await logAction(action);
        return { ok: true, data: { moved: batchIds.length } };
      }

      case "SPLIT": {
        const { batchIds: [batchId], toLocationId, splitQuantity } = action;
        const ref = db.collection("batches").doc(batchId);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error(`Batch ${batchId} not found`);
          const batch = snap.data() as any;
          if (splitQuantity <= 0) throw new Error("splitQuantity must be > 0");
          if (splitQuantity >= batch.quantity) throw new Error("splitQuantity must be < batch.quantity");

          tx.update(ref, {
            quantity: FieldValue.increment(-splitQuantity),
            updatedAt: FieldValue.serverTimestamp(),
          });
          const newRef = db.collection("batches").doc();
          tx.set(newRef, {
            ...batch,
            parentBatchId: batchId,
            locationId: toLocationId,
            quantity: splitQuantity,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await logAction(action);
        return { ok: true, data: { split: true } };
      }

      case "FLAGS": {
        const { batchIds, trimmed, spaced } = action;
        for (const batchId of batchIds) {
          const ref = db.collection("batches").doc(batchId);
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error(`Batch ${batchId} not found`);
            const patch: Record<string, unknown> = {
              updatedAt: FieldValue.serverTimestamp(),
            };
            if (typeof trimmed === "boolean") patch["trimmed"] = trimmed;
            if (typeof spaced === "boolean") patch["spaced"] = spaced;
            tx.update(ref, patch);
          });
        }
        await logAction(action);
        return { ok: true, data: { updated: batchIds.length } };
      }

      case "NOTE": {
        await logAction(action);
        return { ok: true, data: { logged: true } };
      }
    }
  } catch (e: any) {
    // allow retry with same actionId
    await db.collection("actionDedup").doc(action.actionId).delete().catch(() => {});
    return { ok: false, error: e?.message ?? "Unknown error" };
  }
}
