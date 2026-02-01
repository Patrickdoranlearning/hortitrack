import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { safeIlikePattern } from "@/server/db/sanitize";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "25");

    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from("nursery_locations")
      .select("id, name, type, nursery_site, health_status")
      .eq("org_id", orgId)
      .order("name")
      .limit(limit);

    if (q) {
      query = query.ilike("name", safeIlikePattern(q));
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/locations] query error", error);
      return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }

    // Transform to camelCase
    const items = (data || []).map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      type: loc.type,
      nurserySite: loc.nursery_site,
      healthStatus: loc.health_status,
    }));
    
    return NextResponse.json({ data: items, items }, { status: 200 });
  } catch (e: any) {
    console.error("[api/locations] 500", e);
    return NextResponse.json({ data: [], items: [], error: e?.message || "Failed to fetch locations" }, { status: 500 });
  }
}
