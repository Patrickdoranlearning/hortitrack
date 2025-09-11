import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/server/db/supabaseServer";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("plant_varieties_compat")
    .select("id, name, family, genus, species, category")
    .order("name");

  if (error) {
    console.error("[lookups/varieties] error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
