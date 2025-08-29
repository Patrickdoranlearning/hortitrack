// src/app/api/catalog/locations/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Query = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(50),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Query.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ error: parse.error.format() }, { status: 400 });

  const { q, limit } = parse.data;
  const supabase = getSupabaseForRequest();

  let query = supabase.from("nursery_locations").select("id,name").order("name", { ascending: true }).limit(limit);
  if (q && q.length > 0) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[catalog.locations] select error", error);
    return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
  }

  return NextResponse.json(data.map(l => ({ value: l.id, label: l.name })));
}
