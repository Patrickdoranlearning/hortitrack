import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const orgId = searchParams.get("orgId");
  const trayOnly = searchParams.get("trayOnly") === "1";

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  let query = supabase.from("plant_sizes")
    .select("id,name,container_type,cell_multiple")
    .eq("org_id", orgId)
    .limit(6);

  if (trayOnly) query = query.in("container_type", ["prop_tray","plug_tray"]); // enum values. :contentReference[oaicite:8]{index=8}
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
