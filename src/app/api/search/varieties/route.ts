import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/client";

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const orgId = searchParams.get("orgId");

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  let query = supabase.from("plant_varieties").select("id,name,family,genus,species").eq("org_id", orgId).limit(6);
  if (q) query = query.ilike("name", `%${q}%`); // trigram index speeds fuzzy. :contentReference[oaicite:7]{index=7}

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
