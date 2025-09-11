import { adminDb } from "@/server/db/admin";
import { query, collection, where, documentId, getDocs } from "firebase-admin/firestore";

export async function getBatchesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  
  const out: Array<{ id: string; batchNumber?: string }> = [];
  for (const c of chunks) {
    const q = adminDb.collection("batches").where(documentId(), "in", c);
    const snap = await q.get();
    snap.forEach(d => out.push({ id: d.id, batchNumber: (d.data() as any)?.batchNumber }));
  }
  return out;
}
