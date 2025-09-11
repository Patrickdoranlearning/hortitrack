import { adminDb } from "@/server/db/admin";

export async function archiveBatch(batchId: string, byUid: string) {
  const ref = adminDb.collection("batches").doc(batchId);
  await ref.set(
    { status: "Archived", archivedAt: new Date(), archivedBy: byUid },
    { merge: true }
  );
}
