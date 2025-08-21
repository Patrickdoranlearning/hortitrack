import "server-only";
import { adminDb } from "@/server/db/admin";

/**
 * Batch IDs: <site>-<yyww>-<seq5>
 * Example: "3-2534-00001"  => site=3, year=2025, week=34, seq=1
 */
export type GenerateBatchIdOptions = {
  siteCode?: string;   // e.g. "1", "2", "3". Defaults to "1" if omitted.
  when?: Date;         // override current date for testing
};

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { isoYear: d.getUTCFullYear(), isoWeek: weekNo };
}

export async function generateNextBatchId(opts: GenerateBatchIdOptions = {}) {
  const site = String(opts.siteCode ?? "1");
  const now = opts.when ?? new Date();
  const { isoYear, isoWeek: ww } = isoWeek(now);
  const yy = String(isoYear).slice(2);
  const yww = `${yy}${String(ww).padStart(2, "0")}`;
  const docRef = adminDb.collection("counters").doc(`batch-${site}-${yww}`);

  // Transaction with small retry loop for high-concurrency safety
  const MAX_TRIES = 3;
  for (let i = 0; i < MAX_TRIES; i++) {
    try {
      const id = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        let seq = 1;
        if (snap.exists) {
          const current = Number(snap.get("seq") ?? 0);
          seq = current + 1;
          tx.update(docRef, { seq, updatedAt: new Date().toISOString() });
        } else {
          tx.set(docRef, { seq: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        const finalSeq = snap.exists ? seq : 1;
        return {id: `${site}-${yww}-${String(finalSeq).padStart(5, "0")}`};
      });
      return id;
    } catch (e) {
      if (i === MAX_TRIES - 1) throw e;
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
  // Should never reach here
  throw new Error("failed to generate batch id");
}

// Kept for compatibility if anything imports it:
export type BatchPhase = "PROPAGATION" | "PLUGS" | "POTTING" | "POTTING";
