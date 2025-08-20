import { NextResponse } from "next/server";
import { applyBatchAction } from "@/server/actions/applyBatchAction";
import { ActionInputSchema } from "@/lib/actions/schema";
import { withTimeout } from "@/lib/async/withTimeout";
import { getBatchesByIds } from "@/server/batches/lookup";
import { dualWriteActionLog } from "@/server/dualwrite";

const ACTION_TIMEOUT_MS = 10_000;

export async function POST(req: Request) {
  const t0 = Date.now();
  const rawBody = await req.json();

  const parsed = ActionInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    console.error("[api/actions] 422 - Zod issues:", parsed.error.issues);
    return NextResponse.json({ ok: false, error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }
  const transformed = parsed.data;

  try {
    const result = await withTimeout(
      applyBatchAction(transformed),
      ACTION_TIMEOUT_MS - (Date.now() - t0) - 250, // leave a small margin
      "action apply timed out"
    );

    if (!result.ok) {
      console.error("[api/actions] 422", result.error, { type: transformed.type, actionId: transformed.actionId });
      return NextResponse.json({ ok: false, error: result.error, issues: (result as any).issues ?? [] }, { status: 422 });
    }

    // fire-and-forget dual-write (non-blocking)
    dualWriteActionLog(transformed).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[api/actions] 500 server error:", error);
    return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const batchIds = searchParams.getAll("batchId");

  if (!batchIds || batchIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing batchId parameter" },
      { status: 400 }
    );
  }

  try {
    const batches = await getBatchesByIds(batchIds);
    return NextResponse.json({ ok: true, data: batches });
  } catch (error: any) {
    console.error("Error fetching batches by ID:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch batches: " + error.message },
      { status: 500 }
    );
  }
}
