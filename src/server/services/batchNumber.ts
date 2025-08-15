// src/server/services/batchNumber.ts
import { adminDb } from "@/server/db/admin";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Returns the current series prefix.
 * Set env: BATCH_SERIES_PREFIX=3  -> "3-000001" style numbers
 */
function getSeriesPrefix(): string {
  return (process.env.BATCH_SERIES_PREFIX ?? "1").trim();
}

/**
 * Allocate the next batch number inside a transaction.
 * Writes/updates: counters/batches { prefix, seq }
 * Returns: "<prefix>-<6-digit seq>"
 */
export async function allocateBatchNumber(
  tx: FirebaseFirestore.Transaction
): Promise<string> {
  const counterRef = adminDb.collection("counters").doc("batches");
  const snap = await tx.get(counterRef);

  const prefix = getSeriesPrefix();
  let seq = 1;

  if (snap.exists) {
    const data = (snap.data() ?? {}) as { prefix?: string; seq?: number };
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

  return `${prefix}-${String(seq).padStart(6, "0")}`;
}
