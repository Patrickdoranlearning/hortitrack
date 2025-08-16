
import { adminDb } from "@/server/db/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { BatchLog } from "@/lib/types";

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
  const batchRef = adminDb.collection("batches").doc(batchId);
  const doc = await batchRef.get();
  if (!doc.exists) {
    throw new Error("Batch not found");
  }
  
  const logHistory: BatchLog[] = doc.data()?.logHistory ?? [];
  const flagEvents = logHistory.filter(log => log.kind === 'flag');

  const flags: Record<string, any> = {};
  const history: FlagEvent[] = [];

  for (const ev of flagEvents) {
    if (!ev?.key) continue;
    flags[ev.key] = ev.value;
    history.push({ 
        kind: "flag",
        key: ev.key,
        value: ev.value,
        at: ev.at ? Timestamp.fromMillis(new Date(ev.at).getTime()) : Timestamp.now(),
        actor: null, // actor not stored yet
        reason: null,
        notes: ev.note,
    });
  }

  // Also read the materialized value from the root as a fallback
  const batchData = doc.data();
  if (batchData?.isTopPerformer != null && flags.isTopPerformer == null) {
      flags.isTopPerformer = batchData.isTopPerformer;
  }


  return { flags, history };
}

export async function setFlag(batchId: string, key: FlagKey, value: any, opts?: {
  actor?: { id?: string; email?: string } | null;
  reason?: string | null;
  notes?: string | null;
}) {
  const batchRef = adminDb.collection("batches").doc(batchId);

  // Note: We use arrayUnion, so we don't need a transaction to read first.
  // This is simpler and avoids contention.

  const newLogEntry: BatchLog = {
    id: `log_${Date.now()}`,
    kind: "flag",
    type: "Note", // Generic type for log viewers
    key,
    value,
    note: opts?.notes || `${key} set to ${value}`,
    at: new Date().toISOString(), // Use ISO string for consistency
    // actor: opts?.actor || null, // Add when auth is integrated
    // reason: opts?.reason || null,
  };

  const updatePayload: { [key: string]: any, logHistory: any, flags: any } = {
    [key]: value,
    logHistory: FieldValue.arrayUnion(newLogEntry),
    // Materialize in a `flags` map as well for easy access
    flags: { [key]: value },
  };

  // Special handling for topPerformer to set the date
  if (key === 'isTopPerformer') {
      updatePayload.topPerformerAt = value ? new Date() : null;
  }

  await batchRef.set(updatePayload, { merge: true });
}
