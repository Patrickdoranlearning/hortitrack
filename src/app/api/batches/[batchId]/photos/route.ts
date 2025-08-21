import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { adminDb, getGcsBucket } from "@/server/db/admin";

// Node runtime for admin SDK + crypto
export const runtime = "nodejs";

// Limits
const SALES_CAP = 6;
const PURCHASE_GROWER_CAP = 3;
const MAX_BYTES = 8 * 1024 * 1024;

function bad(status: number, code: string, message: string, fields?: any) {
  return NextResponse.json({ ok: false, error: { code, message, fields } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const snap = await adminDb
      .collection("batches")
      .doc(params.batchId)
      .collection("photos")
      .orderBy("createdAt", "desc")
      .get();

    const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, data: { photos } }, { status: 200 });
  } catch (e: any) {
    return bad(500, "LIST_FAIL", e?.message ?? "Failed to list photos");
  }
}

export async function POST(req: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    // Basic authz (expand as you wire roles):
    const role = (req.headers.get("x-role") ?? "").toUpperCase(); // e.g. "ADMIN"|"GROWER"|"SALES"
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const type = String(form.get("type") ?? "GROWER").toUpperCase() as "GROWER" | "SALES";

    if (!file) return bad(400, "NO_FILE", "Missing file");
    if (!["GROWER", "SALES"].includes(type)) return bad(400, "BAD_TYPE", "type must be GROWER|SALES");
    if (file.size > MAX_BYTES) return bad(413, "TOO_LARGE", "Max 8MB");

    if (type === "SALES" && !["ADMIN", "SALES", "GROWER"].includes(role)) {
      return bad(403, "FORBIDDEN", "Insufficient permissions to upload Sales photos");
    }
    if (type === "GROWER" && !["ADMIN", "GROWER"].includes(role)) {
      return bad(403, "FORBIDDEN", "Insufficient permissions to upload Grower photos");
    }

    const batchRef = adminDb.collection("batches").doc(params.batchId);
    const batchSnap = await batchRef.get();
    if (!batchSnap.exists) return bad(404, "NOT_FOUND", "Batch not found");

    const batch = batchSnap.data() || {};
    const isPurchase = (batch.sourceType ?? "Propagation") === "Purchase";

    // Enforce caps per type
    const typeCountSnap = await batchRef.collection("photos").where("type", "==", type).get();
    if (type === "SALES" && typeCountSnap.size >= SALES_CAP) {
      return bad(400, "LIMIT", "Reached Sales photo limit");
    }
    if (type === "GROWER" && isPurchase && typeCountSnap.size >= PURCHASE_GROWER_CAP) {
      return bad(400, "LIMIT", "Reached Check-in photo limit (3)");
    }

    // Upload to Firebase Storage (GCS)
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.type?.split("/")?.[1] ?? "bin").replace(/[^a-z0-9]/gi, "");
    const objectPath = `batches/${params.batchId}/photos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bucket = getGcsBucket();
    const token = crypto.randomUUID();

    await bucket.file(objectPath).save(buf, {
      contentType: file.type || "application/octet-stream",
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

    const doc = await batchRef.collection("photos").add({
      url,
      type,
      createdAt: FieldValue.serverTimestamp(),
      uploadedByRole: role || null,
    });

    // Append a log entry (best effort)
    await batchRef.update({
      logHistory: FieldValue.arrayUnion({
        type: "Photo",
        photoType: type,
        date: new Date().toISOString(),
        note: `${type} photo added`,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    return NextResponse.json({ ok: true, data: { id: doc.id, url, type } }, { status: 201 });
  } catch (e: any) {
    console.error("[photos POST] error", e);
    return bad(500, "UPLOAD_FAIL", e?.message ?? "Failed to upload");
  }
}
