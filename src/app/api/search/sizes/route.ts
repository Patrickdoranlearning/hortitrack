import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const trayOnly = searchParams.get("trayOnly") === "1";

  let query = supabase
    .from("plant_sizes")
    .select("id, name, container_type, cell_multiple, cell_diameter_mm, cell_volume_l")
    .ilike("name", q ? `%${q}%` : "%")
    .order("name")
    .limit(20);

  if (trayOnly) {
    query = query.in("container_type", ["prop_tray", "plug_tray"]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 200 });

  return NextResponse.json({
    items: (data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      meta: { container_type: s.container_type, cell_multiple: s.cell_multiple, cell_diameter_mm: s.cell_diameter_mm, cell_volume_l: s.cell_volume_l }
    }))
  });
}
