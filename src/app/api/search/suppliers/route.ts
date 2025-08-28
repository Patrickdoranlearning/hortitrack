import { NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { snakeToCamel } from "@/lib/utils";

export async function GET(req: Request) {
  const supabase = getSupabaseServerApp();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const orgId = searchParams.get("orgId");

  let query = supabase
    .from("suppliers")
    .select("id,name,country_code")
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });

  return NextResponse.json({
    items: (data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      meta: { countryCode: s.country_code }
    }))
  });
}
