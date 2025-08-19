export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";
import { parseScanCode } from "@/server/scan/parse";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { getUserFromRequest } from "@/server/security/auth";

/** Try to find a batch by several likely keys/variants. */
async function findBatch(by: "id" | "batchNumber", value: string) {
  // 1) exact doc id
  if (by === "id") {
    const doc = await adminDb.collection("batches").doc(value).get();
    if (doc.exists) return { id: doc.id, ...doc.data() };
  }
  const col = adminDb.collection("batches");

  // Helpers
  const tryString = async (field: string, v: string) => {
    const s = await col.where(field, "==", v).limit(1).get();
    return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
  };
  const tryNumber = async (field: string, v: string) => {
    if (!/^\d+$/.test(v)) return null;
    const n = Number(v);
    const s = await col.where(field, "==", n).limit(1).get();
    return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() };
  };
  const candidates = new Set<string>();
  candidates.add(value);
  // also try trimmed leading zeros (common label formatter)
  if (/^0+\d+$/.test(value)) candidates.add(value.replace(/^0+/, ""));

  const fields = ["batchNumber", "batch_no", "batch_no_str", "number"];
  for (const v of candidates) {
    // string first
    for (const f of fields) {
      const r = await tryString(f, v);
      if (r) return r;
    }
    // then numeric, if applicable
    for (const f of fields) {
      const r = await tryNumber(f, v);
      if (r) return r;
    }
  }

  // aliases array (string)
  for (const v of candidates) {
    const a = await col.where("aliases", "array-contains", v).limit(1).get();
    if (!a.empty) return { id: a.docs[0].id, ...a.docs[0].data() };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = requestKey(req as any, user.uid);
    const rl = await checkRateLimit({ key: `scan:${key}`, windowMs: 60_000, max: 30 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", resetMs: rl.resetMs }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "");
    const started = Date.now();
    const parsed = parseScanCode(code);
    if (!parsed) {
      return NextResponse.json({ error: "Unrecognized code" }, { status: 422 });
    }

    const match = await findBatch(parsed.by, parsed.value);
    if (!match) {
      return NextResponse.json(
        {
          error: "Batch not found",
          summary: {
            by: parsed.by,
            value: parsed.value,
            rawLen: code.length,
            ms: Date.now() - started,
          },
        },
        { status: 404 }
      );
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
