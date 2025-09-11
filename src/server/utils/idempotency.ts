import { adminDb } from "@/server/db/admin";

type Stored = { status: number; body: any; createdAt: string };

export async function withIdempotency(key: string | null | undefined, exec: () => Promise<{ status: number; body: any }>) {
  if (!key) return exec();
  const ref = adminDb.collection("idempotency").doc(key);
  const snap = await ref.get();
  if (snap.exists) {
    const s = snap.data() as Stored;
    return { status: s.status, body: s.body };
  }
  const res = await exec();
  await ref.set({ status: res.status, body: res.body, createdAt: new Date().toISOString() }).catch(()=>{});
  return res;
}
