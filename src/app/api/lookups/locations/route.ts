import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { getActiveOrgId } from "@/server/auth/org";

export async function GET(req: Request) {
  try {
    const sb = getSupabaseForRequest(req);
    const orgId = await getActiveOrgId(sb);

    const { data, error } = await sb
      .from("nursery_locations")
      .select("id, name")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ locations: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load locations" }, { status: 500 });
  }
}
