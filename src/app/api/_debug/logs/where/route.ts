import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("batchId")?.trim();
  if (!id) return NextResponse.json({ error: "batchId is required" }, { status: 400 });

  const results: Record<string, { count: number; sample?: { path: string; id: string } }> = {};

  // 1) subcollection under the batch: batches/{id}/logs
  try {
    const snap = await adminDb.collection("batches").doc(id).collection("logs").limit(5).get();
    results["batches/{id}/logs"] = {
      count: snap.size,
      sample: snap.empty ? undefined : { path: snap.docs[0].ref.path, id: snap.docs[0].id },
    };
  } catch (e) {
    results["batches/{id}/logs"] = { count: -1 };
  }

  // 2) collectionGroup("logs") filtered by batchId
  try {
    const cg = await adminDb.collectionGroup("logs").where("batchId", "==", id).limit(5).get();
    results["collectionGroup(logs){batchId==}"] = {
      count: cg.size,
      sample: cg.empty ? undefined : { path: cg.docs[0].ref.path, id: cg.docs[0].id },
    };
  } catch (e) {
    results["collectionGroup(logs){batchId==}"] = { count: -1 };
  }

  // 3) common root collections
  const roots = ["logs", "activity", "events", "audit", "auditLogs", "batchLogs"];
  for (const col of roots) {
    try {
      const rs = await adminDb.collection(col).where("batchId", "==", id).limit(5).get();
      results[`/${col}{batchId==}`] = {
        count: rs.size,
        sample: rs.empty ? undefined : { path: rs.docs[0].ref.path, id: rs.docs[0].id },
      };
    } catch {
      results[`/${col}{batchId==}`] = { count: -1 };
    }
  }

  return NextResponse.json({ batchId: id, results });
}
