import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }
  const { batchId } = await req.json().catch(() => ({}));
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const ref = adminDb.collection("batches").doc(String(batchId)).collection("logs").doc();
  await ref.set({
    kind: "flag",
    key: "isTopPerformer",
    value: true,
    batchId: String(batchId),
    at: FieldValue.serverTimestamp(),
    reason: "debug-seed",
  });

  return NextResponse.json({ ok: true, path: ref.path });
}
