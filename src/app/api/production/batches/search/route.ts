
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Query = z.object({
  q: z.string().trim().min(0).max(100).optional(),
  status: z.enum(["Growing","Ready","Archived"]).optional(),
  phase: z.string().optional(), // keep free-form if your enum differs
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parse = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const { q, status, phase, page, pageSize } = parse.data;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sb = getSupabaseForRequest();

  // base select with exact count for pagination
  let query = sb.from("v_batch_search")
    .select("id, org_id, batch_number, status, phase, quantity, ready_at, variety_name, family, size_name, location_name, supplier_name",
      { count: "exact" })
    .order("ready_at", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (phase)  query = query.eq("phase", phase);
  if (q && q.length) {
    const like = `%${q.toLowerCase()}%`;
    query = query.or([
      `batch_number.ilike.${like}`,
      `variety_name.ilike.${like}`,
      `family.ilike.${like}`,
      `size_name.ilike.${like}`,
      `location_name.ilike.${like}`,
      `supplier_name.ilike.${like}`,
    ].join(","));
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({
    page,
    pageSize,
    total: count ?? 0,
    items: data ?? [],
  });
}
