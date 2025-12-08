
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { orgId } = await req.json();
  const sb = await createClient();
  const { error } = await sb.rpc("switch_active_org", { _org: orgId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
