import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/server/db/supabaseServer";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("plant_sizes")
    .select("id, name, container_type, cell_multiple")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
