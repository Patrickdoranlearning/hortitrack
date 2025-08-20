
import { db, FieldValue } from "@/lib/firebase-admin";
import { ActionInputSchema, type ActionInput } from "@/lib/actions/schema";
import { toMessage } from "@/lib/errors";

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

function toLegacyLogEntry(action: ActionInput) {
  return {
    id: action.actionId,
    date: FieldValue.serverTimestamp(),
    type: action.type.toLowerCase(),
    note: action.reason || action.title || action.note || undefined,
    qty: action.quantity,
    newLocation: action.toLocationId,
    photoUrl: action.photos && action.photos.length ? action.photos[0].url : undefined,
  };
}

async function getBatchById(id: string) {
    const snap = await db.collection("batches").doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as { quantity: number };
}

export async function applyBatchAction(action: ActionInput): Promise<Result> {
  const firstUse = await ensureIdempotent(action.actionId);
  if (!firstUse) return { ok: true, data: { idempotent: true } };

  try {
    switch (action.type) {
      case "DUMPED": {
        const { batchIds, quantity, reason } = action;
        for (const batchId of batchIds) {
          const ref = db.collection("batches").doc(batchId);
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error(`Batch ${batchId} not found`);
            const batch = snap.data() as any;
            if (quantity! > batch.quantity) throw new Error("Insufficient quantity to dump");
            const remaining = (batch.quantity ?? 0) - quantity!;
            const patch: Record<string, any> = {
              quantity: FieldValue.increment(-quantity!),
              updatedAt: FieldValue.serverTimestamp(),
              lastDumpedReason: reason,
            };
            const entry = toLegacyLogEntry(action);
            patch.logHistory = FieldValue.arrayUnion(entry);
            if (remaining === 0) {
              patch.status = "Archived"; 
            }
            tx.update(ref, patch);
          });
        }
        await logAction(action);
        return { ok: true, data: { dumped: batchIds.length, qtyPerBatch: quantity } };
      }
      case "MOVE": {
        const { batchIds, toLocationId } = action;
        for (const batchId of batchIds) {
          const ref = db.collection("batches").doc(batchId);
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) throw new Error(`Batch ${batchId} not found`);
            const batch = snap.data() as any;
            const moveQty = action.quantity ?? batch.quantity;
            if (moveQty <= 0) throw new Error("Quantity must be > 0");
            if (moveQty > batch.quantity) throw new Error("Insufficient quantity");

            if (moveQty === batch.quantity) {
              tx.update(ref, {
                location: toLocationId, 
                locationId: toLocationId,
                updatedAt: FieldValue.serverTimestamp(),
              });
              const entry = toLegacyLogEntry(action);
              tx.update(ref, { logHistory: FieldValue.arrayUnion(entry) });
            } else {
              tx.update(ref, {
                quantity: FieldValue.increment(-moveQty),
                updatedAt: FieldValue.serverTimestamp(),
              });
              const entry = toLegacyLogEntry(action);
              tx.update(ref, { logHistory: FieldValue.arrayUnion(entry) });
              const newRef = db.collection("batches").doc();
              tx.set(newRef, {
                ...batch,
                parentBatchId: batchId,
                location: toLocationId,
                locationId: toLocationId,
                quantity: moveQty,
                initialQuantity: moveQty,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
              const entry2 = toLegacyLogEntry(action);
              tx.set(newRef, { logHistory: [entry2] }, { merge: true });
            }
          });
        }
        await logAction(action);
        return { ok: true, data: { moved: batchIds.length } };
      }

      case "SPLIT": {
        const { batchIds: [batchId], toLocationId, quantity } = action;
        const ref = db.collection("batches").doc(batchId);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new Error(`Batch ${batchId} not found`);
          const batch = snap.data() as any;
          if (quantity! <= 0) throw new Error("quantity must be > 0");
          if (quantity! >= batch.quantity) throw new Error("quantity must be < batch.quantity");

          tx.update(ref, {
            quantity: FieldValue.increment(-quantity!),
            updatedAt: FieldValue.serverTimestamp(),
          });
          const entry = toLegacyLogEntry(action);
          tx.update(ref, { logHistory: FieldValue.arrayUnion(entry) });
          const newRef = db.collection("batches").doc();
          tx.set(newRef, {
            ...batch,
            parentBatchId: batchId,
            location: toLocationId,
            locationId: toLocationId,
            quantity: quantity,
            initialQuantity: quantity,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          const entry2 = toLegacyLogEntry(action);
          tx.set(newRef, { logHistory: [entry2] }, { merge: true });
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
        // Append legacy history entries for history view
        await Promise.all(batchIds.map((id) =>
          db.collection("batches").doc(id)
            .update({ logHistory: FieldValue.arrayUnion(toLegacyLogEntry(action)) })
            .catch(() => {})
        ));
        return { ok: true, data: { updated: batchIds.length } };
      }

      case "NOTE": {
        await logAction(action);
        // Append legacy history entries for history view
        await Promise.all(action.batchIds.map((id) =>
          db.collection("batches").doc(id)
            .update({ logHistory: FieldValue.arrayUnion(toLegacyLogEntry(action)) })
            .catch(() => {})
        ));
        return { ok: true, data: { logged: true } };
      }
    }
  } catch (e: any) {
    await db.collection("actionDedup").doc(action.actionId).delete().catch(() => {});
    return { ok: false, error: toMessage(e) };
  }
}
