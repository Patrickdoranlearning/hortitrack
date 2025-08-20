import { NextRequest, NextResponse } from "next/server";
import { applyBatchAction } from "@/server/actions/applyBatchAction";
// If you use auth, import and enforce here.

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await applyBatchAction(payload);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json(result.data, { status: 200 });
  } catch (e: any) {
    console.error("[api/actions] POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
