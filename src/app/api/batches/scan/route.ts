
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";
import { parseScanCode } from "@/server/scan/parse";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing ?code= query parameter." }, { status: 400 });
  }

  const parsed = parseScanCode(code);
  if (!parsed) {
    // Dev-only observability to diagnose formats safely
    if (process.env.NODE_ENV !== "production") {
      const safe = String(code).slice(0, 160).replace(/[^\x20-\x7E]/g, ".");
      console.warn(`[scan] unrecognized. len=${code.length} sample="${safe}"`);
    }
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
