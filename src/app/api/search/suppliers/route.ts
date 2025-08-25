import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

function norm(v: string | null) {
  const x = (v ?? "").trim();
  return x && x !== "undefined" && x !== "null" ? x : null;
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const orgId = norm(searchParams.get("orgId"));
  if (!orgId) return NextResponse.json({ items: [], error: "Missing orgId" }, { status: 200 });

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, producer_code, country_code")
    .eq("org_id", orgId)
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });

  return NextResponse.json({
    items: (data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      meta: { producer_code: s.producer_code, country_code: s.country_code }
    }))
  });
}
