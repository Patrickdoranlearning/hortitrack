import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { getBearerToken, getUserIdFromJWT } from "@/server/auth/token";

export async function GET(req: Request) {
  try {
    const sb = getSupabaseForRequest(req);
    const token = getBearerToken(req);
    const userId = token ? getUserIdFromJWT(token) : undefined;
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    // RLS: user can read their own profile row
    const { data: prof, error: pErr } = await sb
      .from("profiles")
      .select("active_org_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prof?.active_org_id) return NextResponse.json({ error: "No active org set" }, { status: 400 });

    const orgId = prof.active_org_id as string;

    const { data, error } = await sb
      .from("nursery_locations")
      .select("id, name")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .order("name", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ locations: data ?? [] });
  } catch (e: any) {
    const msg = e?.message ?? "Failed to load locations";
    const status = /unauth/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
