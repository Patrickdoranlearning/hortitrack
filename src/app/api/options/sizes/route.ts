// src/app/api/options/sizes/route.ts
import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const supabase = getSupabaseForRequest();

  const query = supabase
    .from("plant_sizes")
    .select("id,name,container_type,cell_multiple")
    .order("container_type", { ascending: true })
    .order("name", { ascending: true })
    .limit(50);

  const { data, error } = await (q
    ? query.ilike("name", `%${q}%`)
    : query);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const options = (data ?? []).map(s => ({
    value: s.id,
    label: s.name,
    meta: { container_type: s.container_type, cell_multiple: s.cell_multiple },
  }));
  return NextResponse.json({ options });
}