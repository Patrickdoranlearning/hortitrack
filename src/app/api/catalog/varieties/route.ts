// src/app/api/catalog/varieties/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Query = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Query.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ error: parse.error.format() }, { status: 400 });

  const { q, limit } = parse.data;
  const supabase = await getSupabaseForRequest();

  let query = supabase.from("plant_varieties").select("id,name,family").order("name", { ascending: true }).limit(limit);
  if (q && q.length > 0) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[catalog.varieties] select error", error);
    return NextResponse.json({ error: "Failed to load varieties" }, { status: 500 });
  }

  return NextResponse.json(
    data.map(v => ({ value: v.id, label: v.name, hint: v.family ?? undefined }))
  );
}
