// src/app/api/catalog/sizes/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Query = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(50),
  for: z.enum(["checkin", "propagation"]).optional(), // future use
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Query.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ error: parse.error.format() }, { status: 400 });

  const { q, limit } = parse.data;
  const supabase = getSupabaseForRequest();

  // Custom ordering: pot -> plug_tray -> propagation_tray
  const orderExpr = `
    CASE container_type
      WHEN 'pot' THEN 1
      WHEN 'plug_tray' THEN 2
      WHEN 'propagation_tray' THEN 3
      ELSE 4
    END
  `;
  let query = supabase
    .from("plant_sizes")
    .select("id,name,container_type,cell_multiple")
    .order(orderExpr as any, { ascending: true })
    .order("name", { ascending: true })
    .limit(limit);

  if (q && q.length > 0) {
    query = query.or(`name.ilike.%${q}%,container_type.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[catalog.sizes] select error", error);
    return NextResponse.json({ error: "Failed to load sizes" }, { status: 500 });
  }

  return NextResponse.json(
    data.map(s => ({
      value: s.id,
      label: s.name,
      meta: { container_type: s.container_type, multiple: s.cell_multiple },
    }))
  );
}
