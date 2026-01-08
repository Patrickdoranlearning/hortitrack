export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const varietyId = searchParams.get("varietyId") ?? searchParams.get("variety");
  const family = searchParams.get("family");
  const activeOnly = searchParams.get("active") === "true";
  const limit = Math.min(Number(searchParams.get("limit") || 25), 100);

  try {
    const { supabase, orgId } = await getUserAndOrg();
    let query = supabase
      .from("protocols")
      .select("id, name, description, definition, route, target_variety_id, target_size_id, is_active, created_at, updated_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (varietyId) {
      query = query.eq("target_variety_id", varietyId);
    }
    if (family) {
      query = query.contains("definition", { plant_family: family });
    }
    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ protocols: data ?? [] });
  } catch (e) {
    console.error("protocol list error", e);
    return NextResponse.json({ error: "Failed to list protocols" }, { status: 500 });
  }
}
