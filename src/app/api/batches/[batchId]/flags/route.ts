export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getFlags, setFlag, type FlagKey } from "@/server/batches/flags";

// GET /api/batches/:id/flags?history=1
export async function GET(req: NextRequest, { params }: { params: { batchId: string } }) {
  const id = params.batchId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const { flags, history } = await getFlags(id);
    const url = new URL(req.url);
    const includeHistory = url.searchParams.get("history") === "1";
    return NextResponse.json({ flags, ...(includeHistory ? { history } : {}) });
  } catch (e: any) {
    console.error("[flags] get failed", e);
    return NextResponse.json({ error: "Failed to load flags" }, { status: 500 });
  }
}

// PATCH /api/batches/:id/flags  { key, value, reason?, notes? }
export async function PATCH(req: NextRequest, { params }: { params: { batchId: string } }) {
  const id = params.batchId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const key = String(body?.key || "").trim() as FlagKey;
  const value = body?.value;
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 422 });

  try {
    // TODO: plug your auth to pass actor info (if available)
    await setFlag(id, key, value, {
      reason: typeof body?.reason === "string" ? body.reason.slice(0, 200) : null,
      notes: typeof body?.notes === "string" ? body.notes.slice(0, 500) : null,
    });
    // Return updated aggregate flags
    const { flags } = await getFlags(id);
    return NextResponse.json({ ok: true, flags });
  } catch (e: any) {
    console.error("[flags] patch failed", e);
    return NextResponse.json({ error: "Failed to set flag" }, { status: 500 });
  }
}
