// src/app/api/search/sizes/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const trayOnly = searchParams.get("trayOnly") === "1";

    const supabase = await supabaseServer();

    let query = supabase
      .from("plant_sizes")
      .select("id,name,container_type,cell_multiple")
      .limit(20);

    if (trayOnly) query = query.in("container_type", ["prop_tray", "plug_tray"]);
    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ items: [], error: error.message }, { status: 200 });
    }

    return NextResponse.json({
        items: (data ?? []).map(v => ({
            id: v.id,
            label: v.name,
            meta: { container_type: v.container_type, cell_multiple: v.cell_multiple }
        }))
    });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message ?? "Unknown error" }, { status: 200 });
  }
}
