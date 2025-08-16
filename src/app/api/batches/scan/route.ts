// Ensure Node runtime (Firebase Admin requires Node)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";

export async function POST(req: NextRequest) {
  // Parser is scoped INSIDE POST to avoid any duplicate-name conflicts.
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

    if (parsed.by === "id") {
      const ref = adminDb.collection("batches").doc(parsed.value);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

      const clean = declassify({ id: snap.id, ...snap.data() });
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
    }

    // by === "batchNumber"
    const q = await adminDb
      .collection("batches")
      .where("batchNumber", "==", parsed.value)
      .limit(1)
      .get();

    if (q.empty) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

    const doc = q.docs[0]!;
    const clean = declassify({ id: doc.id, ...doc.data() });
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
