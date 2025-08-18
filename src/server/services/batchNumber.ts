
import { adminDb } from "@/server/db/admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

export type BatchStage = "propagation" | "plug" | "potting";

const STAGE_CODE: Record<BatchStage, 1 | 2 | 3> = {
  propagation: 1,
  plug: 2,
  potting: 3,
};

function isoWeek(date = new Date()) {
  // ISO 8601 week from UTC date
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
function yyww(date = new Date()) {
  const { year, week } = isoWeek(date);
  return `${String(year).slice(-2)}${String(week).padStart(2, "0")}`; // e.g. "2534"
}
function pad(n: number, width = 5) {
  return String(n).padStart(width, "0");
}

export async function allocateBatchNumber(
  tx: Transaction,
  opts: {
    stage: BatchStage;
    // when creating a batch from multiple inputs (e.g. potting from several plug cells)
    joinCount?: number | null;
    at?: Date; // optional date (defaults now) for YYWW bucketing
  }
): Promise<string> {
  const stage = opts.stage;
  if (!(stage in STAGE_CODE)) {
    throw new Error(`Invalid stage: ${stage}`);
  }
  const code = STAGE_CODE[stage];
  const weekKey = yyww(opts.at || new Date());

  // Counter doc: counters/batchNumbers/{code}-{weekKey}
  const counterRef = adminDb.collection("counters").doc(`batchNumbers_${code}-${weekKey}`);
  const registry = adminDb.collection("batchNumbers"); // registry docs keyed by final number string

  let nextSeq = 0;
  let batchNumber = "";
  let attempt = 0;

  const snap = await tx.get(counterRef);
  const current = (snap.exists ? (snap.data()?.seq as number) : 0) || 0;
  nextSeq = current + 1;

  batchNumber = `${code}-${weekKey}-${pad(nextSeq)}`;

  // Join suffix if >1 inputs
  const k = typeof opts.joinCount === "number" ? Math.max(0, Math.floor(opts.joinCount)) : 0;
  if (k > 1) batchNumber = `${batchNumber}-J${k}`;

  // Ensure global uniqueness by reserving registry doc - note this is outside the main logic flow for simplicity.
  // A collision is extremely unlikely. A more robust system might retry inside the transaction.
  const regRef = registry.doc(batchNumber);
  const regSnap = await tx.get(regRef);
  if (regSnap.exists) {
    // In the rare case of a collision, we'll just append a random character to make it unique.
    // A production system might have a more sophisticated retry loop.
    batchNumber = `${batchNumber}-${Math.random().toString(36).substring(2, 7)}`;
  }

  // write counter & registry
  tx.set(counterRef, { seq: nextSeq, weekKey, code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  tx.set(registry.doc(batchNumber), { // Use the potentially modified batch number for the registry
    number: batchNumber,
    code,
    stage,
    weekKey,
    seq: nextSeq,
    joinCount: k > 1 ? k : null,
    reservedAt: FieldValue.serverTimestamp(),
  });

  return batchNumber;
}

export async function generateBatchNumber(opts: {
  stage: BatchStage;
  joinCount?: number | null;
  at?: Date;
}) {
  let batchNumber = "";
  await adminDb.runTransaction(async (tx) => {
    batchNumber = await allocateBatchNumber(tx, opts);
  });
  return batchNumber;
}
