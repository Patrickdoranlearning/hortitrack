// Ensure Node runtime (Firebase Admin requires Node)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";

/**
 * Try to find a batch by several likely keys/variants.
 * - If by "id": get doc by id, else try array fields that may store external ids.
 * - If by "batchNumber": try exact, normalized variants, and common alternate fields.
 */
async function findBatch(by: "id" | "batchNumber", value: string) {
  if (by === "id") {
    // 1) Direct document id
    const ref = adminDb.collection("batches").doc(value);
    const snap = await ref.get();
    if (snap.exists) return { id: snap.id, ...snap.data() };

    // 2) External id arrays (tolerant; these fields can exist or not)
    //    If your schema doesn't have them, these queries just return empty.
    const idFields = ["externalIds", "labels", "codes", "altCodes"];
    for (const field of idFields) {
      const q = await adminDb
        .collection("batches")
        .where(field, "array-contains", value)
        .limit(1)
        .get();
      if (!q.empty) return { id: q.docs[0]!.id, ...q.docs[0]!.data() };
    }

    // 3) Single-value id mirrors
    const singleIdFields = ["externalId", "labelCode", "qrCode", "dmCode"];
    for (const field of singleIdFields) {
      const q = await adminDb
        .collection("batches")
        .where(field, "==", value)
        .limit(1)
        .get();
      if (!q.empty) return { id: q.docs[0]!.id, ...q.docs[0]!.data() };
    }

    return null;
  }

  // by === "batchNumber"
  const exact = await adminDb
    .collection("batches")
    .where("batchNumber", "==", value)
    .limit(1)
    .get();
  if (!exact.empty) return { id: exact.docs[0]!.id, ...exact.docs[0]!.data() };

  // Variants:
  const digitsOnly = value.replace(/\D+/g, "");                  // e.g., "1-000123" -> "1000123" or "000123"
  const noHyphen = value.replace(/-/g, "");                      // "1-000123" -> "1000123"
  const hyphenParts = value.match(/^(\d{1,2})-(\d{1,6})$/);
  const noLeadingZeros =
    hyphenParts ? `${hyphenParts[1]}-${String(parseInt(hyphenParts[2], 10))}` : value;

  const candidates = Array.from(
    new Set(
      [value, digitsOnly, noHyphen, noLeadingZeros].filter(Boolean)
    )
  );

  // Try common fields that might store the batch number or its variants
  const fields = [
    "batchNumber",
    "legacyBatchNumber",
    "labelBatch",
    "altBatchNumber",
  ];

  for (const field of fields) {
    for (const cand of candidates) {
      const q = await adminDb
        .collection("batches")
        .where(field, "==", cand)
        .limit(1)
        .get();
      if (!q.empty) return { id: q.docs[0]!.id, ...q.docs[0]!.data() };
    }
  }

  // Array-contains variants (alt numbers kept as an array)
  const arrayFields = ["altBatchNumbers", "labels", "codes"];
  for (const field of arrayFields) {
    for (const cand of candidates) {
      const q = await adminDb
        .collection("batches")
        .where(field, "array-contains", cand)
        .limit(1)
        .get();
      if (!q.empty) return { id: q.docs[0]!.id, ...q.docs[0]!.data() };
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  // Parser is scoped INSIDE POST to avoid duplicate-name conflicts anywhere else.
  function parseScan(raw: string): { by: "id" | "batchNumber"; value: string } | null {
    if (!raw) return null;

    // 1) Normalize: strip control chars (FNC1 etc.), collapse spaces
    let code = String(raw)
      .replace(/[\u0000-\u001F\u007F]/g, "") // control chars (incl. FNC1)
      .replace(/\s+/g, " ")
      .trim();

    // 2) Our explicit prefixes
    if (/^ht:batch:/i.test(code)) {
      const v = code.split(":").pop()!.trim();
      if (/^\d{4,}$/.test(v) || /^\d{1,2}-\d{6}$/.test(v)) return { by: "batchNumber", value: v };
    }
    if (/^ht:id:/i.test(code)) {
      const v = code.split(":").pop()!.trim();
      if (/^[A-Za-z0-9_-]{16,32}$/.test(v)) return { by: "id", value: v };
    }

    // 3) Firestore-like doc id (URL-safe, 16–32 chars)
    if (/^[A-Za-z0-9_-]{16,32}$/.test(code)) return { by: "id", value: code };

    // 4) Batch number formats
    if (/^\d{4,}$/.test(code) || /^\d{1,2}-\d{6}$/.test(code)) {
      return { by: "batchNumber", value: code };
    }

    // 5) Embedded tokens (GS1 / mixed payloads)
    const idToken = (code.match(/[A-Za-z0-9_-]{16,32}/g) || []).find(Boolean);
    if (idToken) return { by: "id", value: idToken };

    const hyphenFmt = (code.match(/\b\d{1,2}-\d{6}\b/) || [])[0];
    if (hyphenFmt) return { by: "batchNumber", value: hyphenFmt };

    const longDigits = (code.match(/\b\d{4,}\b/) || [])[0];
    if (longDigits) return { by: "batchNumber", value: longDigits };

    // 6) URL-encoded once?
    try {
      const dec = decodeURIComponent(code);
      if (dec !== code) return parseScan(dec);
    } catch {
      // ignore decode errors
    }

    return null;
  }

  try {
    const { code } = (await req.json()) as { code?: string };
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Missing 'code' in request body." }, { status: 400 });
    }

    const parsed = parseScan(code);
    if (!parsed) {
      return NextResponse.json({ error: "Unrecognized code format." }, { status: 400 });
    }

    const match = await findBatch(parsed.by, parsed.value);
    if (!match) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const clean = declassify({ id: (match as any).id, ...(match as any) });
    const summary = {
      id: clean.id,
      batchNumber: clean.batchNumber,
      variety: clean.plantVariety,
      family: clean.plantFamily,
      size: clean.size,
      location: clean.location,
      status: clean.status,
    };
    return NextResponse.json({ batch: clean, summary }, { status: 200 });
  } catch (e: any) {
    console.error("POST /api/batches/scan error:", e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
