
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { applyBatchAction } from "@/server/actions/applyBatchAction";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await applyBatchAction(payload);
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
