import { NextRequest, NextResponse } from "next/server";
import { adminDb, getGcsBucket } from "@/server/db/admin";
import { FieldValue } from "firebase-admin/firestore";
import mime from "mime";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return bad(400, "Missing batch id.");

  const snap = await adminDb
    .collection("batches")
    .doc(id)
    .collection("photos")
    .orderBy("uploadedAt", "desc")
    .limit(50)
    .get();

  const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ photos });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return bad(400, "Missing batch id.");

  const form = await req.formData().catch(() => null);
  if (!form) return bad(400, "Invalid form data.");

  const file = form.get("file") as unknown as File | null;
  if (!file) return bad(400, "Missing file field.");
  if (typeof file.arrayBuffer !== "function") return bad(400, "Invalid file.");

  const type = file.type || "application/octet-stream";
  if (!type.startsWith("image/")) return bad(415, "Only image uploads allowed.");
  if (file.size > MAX_BYTES) return bad(413, "Image too large (max 8MB).");

  const ext = mime.getExtension(type) || "jpg";
  const buf = Buffer.from(await file.arrayBuffer());

  const objectPath = `batches/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const token = crypto.randomUUID();

  try {
    // Acquire bucket by name; surface helpful error if missing
    const bucket = getGcsBucket();
    // Store in default bucket, make tokenized public URL
    const gcsFile = bucket.file(objectPath);
    await gcsFile.save(buf, {
      resumable: false,
      contentType: type,
      metadata: {
        metadata: { firebaseStorageDownloadTokens: token },
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      objectPath
    )}?alt=media&token=${token}`;

    // Persist metadata in a subcollection (scales better than array)
    const doc = await adminDb
      .collection("batches")
      .doc(id)
      .collection("photos")
      .add({
        url: publicUrl,
        path: objectPath,
        token,
        contentType: type,
        size: file.size,
        uploadedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      photo: { id: doc.id, url: publicUrl, path: objectPath },
    });
  } catch (err: any) {
    if (err?.code === "STORAGE_BUCKET_MISSING") {
      console.error("photo upload failed: bucket missing");
      return bad(503, "Storage bucket is not configured.");
    }
    console.error("photo upload failed", err);
    return bad(500, "Upload failed.");
  }
}
