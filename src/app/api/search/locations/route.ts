import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer"; // Updated import
import { snakeToCamel } from "@/lib/utils";

export async function GET(req: Request) {
  const supabase = getSupabaseForRequest(); // Updated call
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const orgId = searchParams.get("orgId"); // Get orgId from URL params

  let query = supabase
    .from("nursery_locations")
    .select("id,name")
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (orgId) {
    query = query.eq("org_id", orgId); // Filter by orgId
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });

  return NextResponse.json({
    items: (data ?? []).map((l: any) => ({
      id: l.id,
      name: l.name,
      meta: {},
    }))
  });
}
