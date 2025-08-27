import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  const { data, error } = await supabase
    .from("plant_varieties")
    .select("id, name, family, genus, species, colour, rating") // Removed 'cultivar'
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });

  return NextResponse.json({
    items: (data ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      meta: { family: v.family, genus: v.genus, species: v.species, colour: v.colour, rating: v.rating } // Removed 'cultivar'
    }))
  });
}
