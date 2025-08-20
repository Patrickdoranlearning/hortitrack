
// Force Node.js runtime (firebase-admin not supported on Edge)
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { applyBatchAction } from "@/server/actions/applyBatchAction";
import { ActionInputSchema } from "@/lib/actions/schema";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = ActionInputSchema.safeParse(payload);
    if (!parsed.success) {
      console.error("[api/actions] Zod error", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid action payload" }, { status: 422 });
    }
    const result = await applyBatchAction(parsed.data);
    if (!result.ok) {
      console.error("[api/actions] 422", result.error, { type: payload?.type });
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json(result.data, { status: 200 });
  } catch (e: any) {
    console.error("[api/actions] 500", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
