
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";

/** Try to understand whatever the scanner read. */
function parseScanCode(raw: string): { by: "id" | "batchNumber"; value: string } | null {
  if (!raw) return null;
  // Normalize: trim, drop common DM control separators (GS/RS/US),
  // and hard-cap length to avoid abuse.
  const code0 = String(raw).trim();
  if (code0.length > 512) return null;
  const code = code0.replace(/[\x1D\x1E\x1F]/g, "");

  // 1) Our recommended encodings
  //    ht:batch:12345  -> batchNumber
  //    ht:id:abc123... -> doc id
  if (/^ht:batch:/i.test(code)) {
    const val = code.split(":").pop()!.trim();
    if (/^\d+$/.test(val)) return { by: "batchNumber", value: val };
  }
  if (/^ht:id:/i.test(code)) {
    const val = code.split(":").pop()!.trim();
    if (/^[A-Za-z0-9_-]{15,}$/.test(val)) return { by: "id", value: val };
  }

  // 1b) Back-compat with existing labels: BATCH:12345
  if (/^batch:/i.test(code)) {
    const val = code.split(":").pop()!.trim();
    if (/^\d+$/.test(val)) return { by: "batchNumber", value: val };
  }

  // 2) Pure number or "#12345" -> batchNumber
  {
    const m = code.match(/^\#?(\d{1,12})$/);
    if (m) return { by: "batchNumber", value: m[1] };
  }

  // 3) Looks like a Firestore doc id (20+ url-safe chars)
  if (/^[A-Za-z0-9_-]{20,}$/.test(code)) {
    return { by: "id", value: code };
  }

  // 4) URL forms – try to pull id or number from path/query
  if (/^https?:\/\//i.test(code)) {
    try {
      const url = new URL(code);
      // /batches/<id>
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p.toLowerCase() === "batches");
      if (idx >= 0 && parts[idx + 1]) {
        const val = parts[idx + 1];
        if (/^[A-Za-z0-9_-]{20,}$/.test(val)) return { by: "id", value: val };
        if (/^\d+$/.test(val)) return { by: "batchNumber", value: val };
      }
      // ?id= or ?batch= or ?batchNumber=
      const qpId = url.searchParams.get("id");
      if (qpId && /^[A-Za-z0-9_-]{15,}$/.test(qpId)) return { by: "id", value: qpId };
      const qpNum = url.searchParams.get("batchNumber") || url.searchParams.get("batch");
      if (qpNum && /^\d+$/.test(qpNum)) return { by: "batchNumber", value: qpNum };
    } catch {
      /* ignore */
    }
  }

  // 5) JSON payloads {"id":"..."} or {"batchNumber":"123"}
  if ((code.startsWith("{") && code.endsWith("}")) || (code.startsWith("%7B") && code.endsWith("%7D"))) {
    try {
      const obj = JSON.parse(decodeURIComponent(code));
      if (obj?.id && /^[A-Za-z0-9_-]{15,}$/.test(obj.id)) return { by: "id", value: obj.id };
      if (obj?.batchNumber && /^\d+$/.test(String(obj.batchNumber))) {
        return { by: "batchNumber", value: String(obj.batchNumber) };
      }
    } catch { /* ignore */ }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing ?code= query parameter." }, { status: 400 });
  }

  const parsed = parseScanCode(code);
  if (!parsed) {
    return NextResponse.json({ error: "Unrecognized code format." }, { status: 422 });
  }

  try {
    let data: any | null = null;
    let id: string | null = null;

    if (parsed.by === "id") {
      const doc = await adminDb.collection("batches").doc(parsed.value).get();
      if (doc.exists) {
        id = doc.id;
        data = doc.data();
      }
    } else {
      // by batchNumber
      const q = await adminDb
        .collection("batches")
        .where("batchNumber", "==", parsed.value)
        .limit(1)
        .get();
      if (!q.empty) {
        const doc = q.docs[0];
        id = doc.id;
        data = doc.data();
      }
    }

    if (!data || !id) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    // Ensure everything is serializable (no Timestamps/DocRefs)
    const clean = declassify({ id, ...data });

    // Optionally include a compact summary the UI can show immediately
    const summary = {
      id: clean.id,
      batchNumber: clean.batchNumber,
      variety: clean.plantVariety,
      family: clean.plantFamily,
      size: clean.size,
      location: clean.location,
      status: clean.status,
      quantity: clean.quantity,
      plantingDate: clean.plantingDate, // ISO
    };

    return NextResponse.json({ batch: clean, summary });
  } catch (err: any) {
    console.error("scan endpoint error:", err);
    return NextResponse.json({ error: err?.message || "Scan lookup failed." }, { status: 500 });
  }
}
