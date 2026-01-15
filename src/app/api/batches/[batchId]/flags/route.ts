export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getFlags, setFlag, type FlagKey } from "@/server/batches/flags";

// GET /api/batches/:id/flags?history=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const id = batchId;
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

import { getUserIdAndOrgId } from "@/server/auth/getUser";

// PATCH /api/batches/:id/flags  { key, value, reason?, notes? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const id = batchId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const key = String(body?.key || "").trim() as FlagKey;
  const value = body?.value;
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 422 });

  try {
    const { userId, orgId } = await getUserIdAndOrgId();
    
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // TODO: Validate org access if necessary (e.g. check if batch belongs to org)

    await setFlag(id, key, value, {
      actor: { id: userId }, // Pass Supabase User ID
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
