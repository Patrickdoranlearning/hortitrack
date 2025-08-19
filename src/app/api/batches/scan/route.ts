export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";
import { parseScanCode } from "@/server/scan/parse";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { getUserFromRequest } from "@/server/security/auth";

/** Try to find a batch by several likely keys/variants. */
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
  try {
    // AuthN (ID token) → required for Admin SDK write-capable routes
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Rate limit
    const key = requestKey(req as any, user.uid);
    const rl = await checkRateLimit({ key: `scan:${key}`, windowMs: 60_000, max: 30 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", resetMs: rl.resetMs }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "");
    const parsed = parseScanCode(code);
    if (!parsed) {
      return NextResponse.json({ error: "Unrecognized code" }, { status: 422 });
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
