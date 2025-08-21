import { NextRequest, NextResponse } from "next/server";
import { adminDb, getGcsBucket } from "@/server/db/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;
const SALES_CAP = 6;
const PURCHASE_GROWER_CAP = 3;

function bad(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const q = await adminDb.collection("batches").doc(params.batchId).collection("photos").orderBy("createdAt","desc").get();
    const photos = q.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, data: { photos } }, { status: 200 });
  } catch (e:any) {
    return bad(500, "SERVER_ERROR", e?.message ?? "Failed to list photos");
  }
}

export async function POST(req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const type = String(form.get("type") ?? "GROWER").toUpperCase(); // 'GROWER' | 'SALES'
    if (!file) return bad(400, "NO_FILE", "Missing file");
    if (file.size > MAX_BYTES) return bad(413, "TOO_LARGE", "Max 8MB");

    const batchRef = adminDb.collection("batches").doc(params.batchId);
    const batchSnap = await batchRef.get();
    if (!batchSnap.exists) return bad(404, "NOT_FOUND", "Batch not found");

    // Caps
    const existing = await batchRef.collection("photos").where("type","==", type).get();
    const isPurchase = (batchSnap.data()?.sourceType ?? "Propagation") === "Purchase";
    if (type === "SALES" && existing.size >= SALES_CAP) return bad(400, "LIMIT", "Reached Sales photo limit");
    if (type === "GROWER" && isPurchase && existing.size >= PURCHASE_GROWER_CAP) return bad(400, "LIMIT", "Reached Check-in photo limit");

    // Upload to GCS (Firebase Storage bucket)
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const ext = (file.type?.split("/")?.[1] ?? "bin").replace(/[^a-z0-9]/gi, "");
    const objectPath = `batches/${params.batchId}/photos/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const bucket = getGcsBucket();
    const token = crypto.randomUUID();
    await bucket.file(objectPath).save(buffer, {
      contentType: file.type || "application/octet-stream",
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

    const doc = await batchRef.collection("photos").add({
      url: publicUrl, type, createdAt: FieldValue.serverTimestamp(),
    });

    // Optional: log entry
    await batchRef.update({
      logHistory: FieldValue.arrayUnion({ type: "Photo", date: new Date().toISOString(), note: type }),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(()=>{});

    return NextResponse.json({ ok: true, data: { id: doc.id, url: publicUrl, type } }, { status: 201 });
  } catch (e:any) {
    return bad(500, "UPLOAD_FAIL", e?.message ?? "Failed to upload");
  }
}
