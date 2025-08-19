
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";
import { parseScanCode } from "@/server/scan/parse";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { getUserFromRequest } from "@/server/security/auth";

/** Try to find a batch by several likely keys/variants. */
async function findBatch(by: "id" | "batchNumber", value: string) {
  // 1) Direct doc id
  if (by === "id") {
    const doc = await adminDb.collection("batches").doc(value).get();
    if (doc.exists) return { id: doc.id, ...doc.data() };
  }
  
  // 2) batchNumber field
  const c1 = await adminDb.collection("batches").where("batchNumber", "==", value).limit(1).get();
  if (!c1.empty) return { id: c1.docs[0].id, ...c1.docs[0].data() };

  // 3) Common alternate/legacy field names
  const altFields = ["batch_no", "legacyBatchNumber", "number"];
  for (const f of altFields) {
    const snap = await adminDb.collection("batches").where(f, "==", value).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  // 4) Aliases/labels array
  const alias = await adminDb.collection("batches").where("aliases", "array-contains", value).limit(1).get();
  if (!alias.empty) return { id: alias.docs[0].id, ...alias.docs[0].data() };

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
