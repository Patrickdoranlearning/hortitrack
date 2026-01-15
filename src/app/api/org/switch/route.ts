
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { orgId } = await req.json();
  const sb = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Verify user is a member of the target org
  const { data: membership } = await sb
    .from("org_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (!membership) {
    return NextResponse.json({ ok: false, error: "Not a member of this organization" }, { status: 403 });
  }

  const { error } = await sb.rpc("switch_active_org", { _org: orgId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
