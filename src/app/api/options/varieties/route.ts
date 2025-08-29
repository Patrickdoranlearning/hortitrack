import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Q = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Q.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) {
    return NextResponse.json({ options: [] }); // keep 200
  }
  const { q, limit } = parse.data;

  const supabase = getSupabaseForRequest();

  let query = supabase.from("plant_varieties")
    .select("id,name,family")
    .order("name", { ascending: true })
    .limit(limit);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[options.varieties]", error);
    return NextResponse.json({ options: [] });
  }

  return NextResponse.json({
    options: (data ?? []).map(v => ({ value: v.id, label: v.name, hint: v.family ?? undefined })),
  });
}