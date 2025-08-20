
// Force Node.js runtime (firebase-admin not supported on Edge)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { applyBatchAction } from "@/server/actions/applyBatchAction";
import { ActionInputSchema } from "@/lib/actions/schema";
import { isAllowedOrigin } from "@/lib/security/origin";
import { toMessage } from "@/lib/errors";

type ApiErrorIssue = { path: (string | number)[]; message: string };

export async function POST(req: NextRequest) {
  try {
    if (!isAllowedOrigin(req)) {
      console.error("[api/actions] Bad Origin", {
        origin: req.headers.get("origin"),
        host: req.headers.get("host"),
        url: req.nextUrl.href,
      });
      return NextResponse.json({ ok: false, error: "Bad Origin", issues: [] }, { status: 403 });
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
    const result = await applyBatchAction(parsed.data);
    if (!result.ok) {
      const msg = toMessage(result.error);
      console.error("[api/actions] 422", msg, { type: parsed.data.type, actionId: parsed.data.actionId });
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
