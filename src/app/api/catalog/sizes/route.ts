import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Q = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Q.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json([]);

  const { q, limit } = parse.data;
  const supabase = await getSupabaseForRequest();

  let query = supabase
    .from("plant_sizes")
    .select("id,name,container_type,cell_multiple")
    .order("name", { ascending: true });

  if (q) {
    query = query.or(`name.ilike.%${q}%,container_type.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[catalog.sizes] select error", error);
    return NextResponse.json([]); // keep 200 for resilience
  }

  const rank = (t?: string | null) =>
    t === "pot" ? 1 : t === "plug_tray" ? 2 : t === "propagation_tray" ? 3 : 4;

  const sorted = (data ?? [])
    .slice()
    .sort((a, b) => {
      const ra = rank(a.container_type);
      const rb = rank(b.container_type);
      if (ra !== rb) return ra - rb;
      return (a.name ?? "").localeCompare(b.name ?? "");
    })
    .slice(0, limit);

  // keep original catalog shape: array of items (not wrapped)
  return NextResponse.json(
    sorted.map((s) => ({
      value: s.id,
      label: s.name,
      meta: { container_type: s.container_type, multiple: s.cell_multiple },
    }))
  );
}