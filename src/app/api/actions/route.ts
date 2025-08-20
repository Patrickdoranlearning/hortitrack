// src/app/api/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ActionInputSchema, type ActionInput } from "@/lib/actions/schema";
import { isAllowedOrigin } from "@/lib/security/origin";
import { applyBatchAction } from "@/server/actions/applyBatchAction";
import { withTimeout } from "@/lib/async/withTimeout";
import { getBatchesByIds } from "@/server/batches/lookup"; 
import { toMessage } from "@/lib/errors";

export const runtime = "nodejs"; // 🔑 Firestore-safe runtime
const ACTION_TIMEOUT_MS = 30_000;
const JSON_PARSE_TIMEOUT_MS = 5_000;
const BATCH_LOOKUP_TIMEOUT_MS = 15_000;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
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

    // Parse input quickly
    const json = await withTimeout(req.json(), JSON_PARSE_TIMEOUT_MS, "request body parse timed out");
    const parsed = ActionInputSchema.safeParse(json);
    
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const issues = [
        ...Object.entries(flat.fieldErrors).flatMap(([k, arr]) =>
          (arr ?? []).map((m) => ({ path: k, message: m }))
        ),
        ...(flat.formErrors ?? []).map((m) => ({ path: "_form", message: m })),
      ];
      console.error("[api/actions] Zod error", { issues });
      return NextResponse.json(
        { ok: false, error: "Invalid action payload", issues },
        { status: 422 }
      );
    }
    
    // Normalize batch refs
    const transformed = parsed.data;
    const { batchIds, batchNumbers } = transformed;

    if (batchIds.length === 0 && batchNumbers.length === 0) {
      return NextResponse.json({ ok: false, error: "No batch reference provided" }, { status: 400 });
    }
    
    if (batchIds.length > 0 && batchNumbers.length === 0) {
        const docs = await withTimeout(getBatchesByIds(batchIds), BATCH_LOOKUP_TIMEOUT_MS, "batch lookup timed out");
        if (docs.length === 0) {
            return NextResponse.json({ ok: false, error: "No batches found for provided ids" }, { status: 404 });
        }
        transformed.batchNumbers = docs.map(d => d.batchNumber).filter(Boolean) as string[];
    }

    // 🔔 MAIN WORK (wrap your service)
    const result = await withTimeout(
      applyBatchAction(transformed),
      ACTION_TIMEOUT_MS - (Date.now() - t0) - 250, // leave a small margin
      "action apply timed out"
    );

    const dur = Date.now() - t0;
    console.info("[/api/actions] ok", { durMs: dur, type: parsed.data.type, ids: batchIds.length, nums: batchNumbers.length });
    
    if (!result.ok) {
      console.error("[api/actions] 422", result.error, { type: transformed.type, actionId: transformed.actionId });
      return NextResponse.json({ ok: false, error: result.error, issues: (result as any).issues ?? [] }, { status: 422 });
    }
    return NextResponse.json({ ok: true, data: result.data }, { status: 200 });

  } catch (e: any) {
    const dur = Date.now() - t0;
    const isTimeout = e?.name === "TimeoutError" || /timed out/i.test(String(e?.message));
    const status = e?.issues ? 422 : (isTimeout ? 504 : 500);
    const msg = toMessage(e);
    const payload = {
      ok: false,
      error: msg || "Internal error",
      issues: e?.issues ?? [],
      durMs: dur,
    };
    console.error("[api/actions] error", { status, ...payload });
    return NextResponse.json(payload, { status });
  }
}
