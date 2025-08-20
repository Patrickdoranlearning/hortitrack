
// src/server/batches/nextId.ts
import { doc, runTransaction } from "firebase/firestore";
import { db as webDb } from "@/lib/firebase"; // your initialized Firestore web client
import { BatchPhase, formatBatchId, computeYYWW } from "@/lib/batches/ids";
import { db as adminDb, FieldValue } from '@/lib/firebase-admin';

/**
 * Reserves the next sequence number for the given ISO week (global per-week).
 * Counter document: sequences/batch-<yyww>
 */
async function reserveSeq(yyww: string): Promise<number> {
  const ref = adminDb.collection("sequences").doc(`batch-${yyww}`);
  const next = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number((snap.data() as any).seq ?? 0) : 0;
    const seq = current + 1;
    if (snap.exists()) {
      tx.update(ref, { seq, updatedAt: FieldValue.serverTimestamp() });
    } else {
      tx.set(ref, { seq, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
    return seq;
  });
  return next;
}

/** Generate a new ID atomically. */
export async function generateNextBatchId(phase: BatchPhase, at = new Date()) {
  const { yyww } = computeYYWW(at);
  const seq = await reserveSeq(yyww);
  const id = formatBatchId(phase, seq, at);
  return { id, seq, yyww };
}
