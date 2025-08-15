// src/server/services/batchNumber.ts
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Returns the current series prefix.
 * Make this configurable: env, Firestore config doc, etc.
 * To match your example ("3-000004"), set BATCH_SERIES_PREFIX=3.
 */
function getSeriesPrefix(): string {
  return process.env.BATCH_SERIES_PREFIX?.trim() || "1";
}

/**
 * Allocate the next batch number inside a transaction.
 * Writes/updates: counters/batches { prefix, seq }
 * Returns: "<prefix>-<6-digit seq>"
 */
export async function allocateBatchNumber(
  tx: FirebaseFirestore.Transaction
): Promise<string> {
  const counterRef = db.collection("counters").doc("batches");
  const snap = await tx.get(counterRef);

  const prefix = getSeriesPrefix();
  let seq = 1;

  if (snap.exists) {
    const data = snap.data() as { prefix?: string; seq?: number } | undefined;
    if (data?.prefix === prefix) {
      seq = (data.seq ?? 0) + 1;
    } else {
      // if prefix changed, reset sequence
      seq = 1;
    }
  }

  tx.set(
    counterRef,
    { prefix, seq, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  const number = `${prefix}-${String(seq).padStart(6, "0")}`;
  return number;
}
