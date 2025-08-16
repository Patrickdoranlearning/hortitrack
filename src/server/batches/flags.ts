import { adminDb } from "@/server/db/admin";
import { FieldValue } from "firebase-admin/firestore";

export type FlagKey = "isTopPerformer" | "quarantined" | "priority"; // extend as needed

export type FlagEvent = {
  kind: "flag";
  key: FlagKey;
  value: boolean | string | number;
  actor?: { id?: string; email?: string } | null;
  at: FirebaseFirestore.Timestamp | Date;
  reason?: string | null;
  notes?: string | null;
};

export async function getFlags(batchId: string) {
  // Aggregate from logs (latest wins)
  const snap = await adminDb
    .collection("batches").doc(batchId)
    .collection("logs")
    .where("kind", "==", "flag")
    .orderBy("at", "asc")
    .limit(500)
    .get();

  const flags: Record<string, any> = {};
  const history: FlagEvent[] = [];
  for (const d of snap.docs) {
    const ev = d.data() as any;
    if (!ev?.key) continue;
    flags[ev.key] = ev.value;
    history.push({ ...ev, at: ev.at });
  }
  return { flags, history };
}

export async function setFlag(batchId: string, key: FlagKey, value: any, opts?: {
  actor?: { id?: string; email?: string } | null;
  reason?: string | null;
  notes?: string | null;
}) {
  const batchRef = adminDb.collection("batches").doc(batchId);
  const logsRef = batchRef.collection("logs");

  await adminDb.runTransaction(async (tx) => {
    // 1) append a log event
    const evRef = logsRef.doc();
    tx.set(evRef, {
      kind: "flag",
      key,
      value,
      actor: opts?.actor || null,
      reason: opts?.reason || null,
      notes: opts?.notes || null,
      at: FieldValue.serverTimestamp(),
    });

    // 2) materialize on batch doc (denormalized, keeps legacy reads working)
    tx.set(batchRef, { [key]: value, flags: { [key]: value } }, { merge: true });
  });
}
