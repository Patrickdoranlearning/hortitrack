// src/app/api/options/locations/route.ts
import { NextResponse } from "next/server";
import { getActiveOrgIdOrThrow, getSupabaseForRequest } from "@/server/db/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const supabase = getSupabaseForRequest();
    let orgId: string;
    try {
      orgId = await getActiveOrgIdOrThrow(supabase);
    } catch (e: any) {
      return NextResponse.json({ options: [], error: e?.message || "Unauthorized" }, { status: 401 });
    }

    const base = supabase
      .from("nursery_locations")
      .select("id,name,site_id,covered")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .limit(50);

    const { data, error } = await (q ? base.ilike("name", `%${q}%`) : base);
    if (error) return NextResponse.json({ options: [], error: error.message }, { status: 500 });

    const options = (data ?? []).map(l => ({
      value: l.id,
      label: l.name,
      meta: { covered: l.covered, site_id: l.site_id },
    }));
    return NextResponse.json({ options });
  } catch (e: any) {
    console.error("[options/locations] unhandled", e);
    return NextResponse.json({ options: [], error: "Unexpected error" }, { status: 500 });
  }
}
