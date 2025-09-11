import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET() {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const { data, error } = await supabase
      .from("nursery_locations")
      .select("id, name, covered, area, nursery_site")
      .eq("org_id", orgId)
      .order("name");

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    console.error("[lookups/locations] error", e);
    return NextResponse.json({ error: e?.message ?? "Lookup failed" }, { status });
  }
}
