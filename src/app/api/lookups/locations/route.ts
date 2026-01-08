import { NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";

export async function GET() {
  try {
    // Get authenticated user's session
    const { orgId, supabase } = await getLightweightAuth();
    
    // Fetch locations using user's authenticated session
    const { data, error } = await supabase
      .from("nursery_locations")
      .select("id, name, covered, area, nursery_site, type, site_id, updated_at, created_at")
      .eq("org_id", orgId)
      .order("name");

    if (error) {
      console.error("[lookups/locations] query error:", error);
      throw error;
    }

    return NextResponse.json(
      { items: data ?? [] },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e: any) {
    const status = /Unauthenticated|No organization/i.test(e?.message) ? 401 : 500;
    console.error("[lookups/locations] error", e);
    return NextResponse.json({ error: e?.message ?? "Lookup failed" }, { status });
  }
}
