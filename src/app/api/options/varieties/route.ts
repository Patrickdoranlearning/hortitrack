// src/app/api/options/varieties/route.ts
import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const supabase = getSupabaseForRequest();

  const query = supabase
    .from("plant_varieties")
    .select("id,name,family,genus,species")
    .order("name", { ascending: true })
    .limit(20);

  const { data, error } = await (q
    ? query.ilike("name", `%${q}%`)
    : query);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const options = (data ?? []).map(v => ({
    value: v.id,
    label: v.name,
    meta: { family: v.family, genus: v.genus, species: v.species },
  }));
  return NextResponse.json({ options });
}