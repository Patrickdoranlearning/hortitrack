import { adminDb } from "@/server/db/admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

export type BatchStage = "propagation" | "plug" | "potting";

const STAGE_CODE: Record<BatchStage, string> = {
  propagation: "1",
  plug: "2",
  potting: "3",
};

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

/**
 * Allocate a 7-digit batch number: [stage(1)][week(2)][seq(4)]
 * Example: "1250001" => stage=1, week=25, seq=0001
 */
export async function allocateBatchNumber(
  tx: Transaction,
  opts: { stage: BatchStage; at?: Date | undefined }
): Promise<string> {
  const at = opts.at ?? new Date();
  const week = isoWeek(at);
  const weekStr = String(week).padStart(2, "0");
  const stage = STAGE_CODE[opts.stage];
  const counterId = `batch-${stage}-${weekStr}`;
  const ref = adminDb.collection("counters").doc(counterId);
  const snap = await tx.get(ref);
  const seq = (snap.exists ? (snap.data()?.seq ?? 0) : 0) + 1;
  tx.set(
    ref,
    { seq, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return `${stage}${weekStr}${String(seq).padStart(4, "0")}`;
}

export async function generateBatchNumber(opts: {
  stage: BatchStage;
  at?: Date;
}) {
  return adminDb.runTransaction(async (tx) => {
    return allocateBatchNumber(tx, opts);
  });
}
