
// Force Node.js runtime (firebase-admin not supported on Edge)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { applyBatchAction } from "@/server/actions/applyBatchAction";
import { ActionInputSchema } from "@/lib/actions/schema";
import { isAllowedOrigin } from "@/lib/security/origin";
import { toMessage } from "@/lib/errors";
import { adminDb } from "@/server/db/admin";
import { query, collection, where, documentId, getDocs } from "firebase/firestore";

type ApiErrorIssue = { path: (string | number)[]; message: string };

async function getBatchesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  
  const out: Array<{ id: string; batchNumber?: string }> = [];
  for (const c of chunks) {
    const q = adminDb.collection("batches").where(documentId(), "in", c);
    const snap = await q.get();
    snap.forEach(d => out.push({ id: d.id, batchNumber: (d.data() as any)?.batchNumber }));
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) {
      console.error("[api/actions] 403 Bad Origin", {
        method: req.method,
        origin: req.headers.get("origin"),
        host: req.headers.get("host"),
        referer: req.headers.get("referer"),
      });
      return NextResponse.json({ ok: false, error: "Bad Origin" }, { status: 403 });
    }

    const payload = await req.json();
    const parsed = ActionInputSchema.safeParse(payload);
    
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const issues: ApiErrorIssue[] = [
        ...Object.entries(flat.fieldErrors).flatMap(([k, arr]) =>
          (arr ?? []).map((m) => ({ path: [k], message: m }))
        ),
        ...(flat.formErrors ?? []).map((m) => ({ path: ["_form"], message: m })),
      ];
      console.error("[api/actions] Zod error", { issues });
      return NextResponse.json(
        { ok: false, error: "Invalid action payload", issues },
        { status: 422 }
      );
    }
    
    const transformed = parsed.data;
    const { batchIds, batchNumbers } = transformed;

    if (batchIds.length === 0 && batchNumbers.length === 0) {
      return NextResponse.json({ ok: false, error: "No batch reference provided" }, { status: 400 });
    }

    if (batchIds.length > 0 && batchNumbers.length === 0) {
        const docs = await getBatchesByIds(batchIds);
        if (docs.length === 0) {
            return NextResponse.json({ ok: false, error: "No batches found for provided ids" }, { status: 404 });
        }
        transformed.batchNumbers = docs.map(d => d.batchNumber).filter(Boolean) as string[];
    }

    const result = await applyBatchAction(transformed);
    if (!result.ok) {
      const msg = toMessage(result.error);
      console.error("[api/actions] 422", msg, { type: transformed.type, actionId: transformed.actionId });
      return NextResponse.json({ ok: false, error: msg, issues: result.issues ?? [] }, { status: 422 });
    }
    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });
  } catch (e: any) {
    const msg = toMessage(e);
    console.error("[api/actions] 500", { message: msg, stack: e?.stack });
    // Force JSON even on unexpected errors
    return NextResponse.json({ ok: false, error: msg || "Internal error", issues: [] }, { status: 500 });
  }
}
