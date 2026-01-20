export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getFlags, setFlag, type FlagKey } from "@/server/batches/flags";
import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { createClient } from "@/lib/supabase/server";

// Helper to validate batch belongs to user's org
async function validateBatchAccess(batchId: string, orgId: string): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .select("org_id")
    .eq("id", batchId)
    .single();

  if (error || !batch) {
    return { valid: false, error: "Batch not found" };
  }

  if (batch.org_id !== orgId) {
    return { valid: false, error: "Not authorized to access this batch" };
  }

  return { valid: true };
}

// GET /api/batches/:id/flags?history=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  if (!batchId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    // Authenticate user
    const { userId, orgId } = await getUserIdAndOrgId();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate batch belongs to user's org
    const access = await validateBatchAccess(batchId, orgId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { flags, history } = await getFlags(batchId);
    const url = new URL(req.url);
    const includeHistory = url.searchParams.get("history") === "1";
    return NextResponse.json({ flags, ...(includeHistory ? { history } : {}) });
  } catch (e: any) {
    console.error("[flags] get failed", e);
    return NextResponse.json({ error: "Failed to load flags" }, { status: 500 });
  }
}

// PATCH /api/batches/:id/flags  { key, value, reason?, notes? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  if (!batchId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const key = String(body?.key || "").trim() as FlagKey;
  const value = body?.value;
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 422 });

  try {
    // Authenticate user
    const { userId, orgId } = await getUserIdAndOrgId();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate batch belongs to user's org
    const access = await validateBatchAccess(batchId, orgId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    await setFlag(batchId, key, value, {
      actor: { id: userId },
      reason: typeof body?.reason === "string" ? body.reason.slice(0, 200) : null,
      notes: typeof body?.notes === "string" ? body.notes.slice(0, 500) : null,
    });
    // Return updated aggregate flags
    const { flags } = await getFlags(batchId);
    return NextResponse.json({ ok: true, flags });
  } catch (e: any) {
    console.error("[flags] patch failed", e);
    return NextResponse.json({ error: "Failed to set flag" }, { status: 500 });
  }
}
