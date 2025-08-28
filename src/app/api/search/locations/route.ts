import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { snakeToCamel } from "@/lib/utils";

export async function GET(req: Request) {
  const supabase = getSupabaseServerApp();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const orgId = searchParams.get("orgId");

  let query = supabase
    .from("nursery_locations")
    .select("id,name")
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (orgId) {
    query = query.eq("org_id", orgId);
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
