
import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Query = z.object({
  q: z.string().trim().min(0).max(100).optional(),
  status: z.enum(["Growing","Ready","Archived"]).optional(),
  behavior: z.enum(["growing", "available", "waste", "archived"]).optional(),
  phase: z.string().optional(), // keep free-form if your enum differs
  varietyId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parse = Query.safeParse(Object.fromEntries(url.searchParams));
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
    }
    const { q, status, behavior, phase, varietyId, page, pageSize } = parse.data;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const sb = await createClient();

    // Check auth
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // base select with estimated count for faster pagination
    let query = sb.from("v_batch_search")
      .select(
        "id, org_id, batch_number, status, status_id, phase, quantity, ready_at, variety_name, family, category, size_name, location_name, supplier_name, behavior, saleable_quantity, sales_photo_url, grower_photo_url",
        { count: "planned" }
      )
      .order("ready_at", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (status) query = query.eq("status", status);
    if (behavior) query = query.eq("behavior", behavior);
    if (phase)  query = query.eq("phase", phase);
    if (varietyId) query = query.eq("plant_variety_id", varietyId);
    if (q && q.length) {
      const like = `%${q.toLowerCase()}%`;
      query = query.or([
        `batch_number.ilike.${like}`,
        `variety_name.ilike.${like}`,
        `size_name.ilike.${like}`,
        `location_name.ilike.${like}`,
        `supplier_name.ilike.${like}`,
      ].join(","));
    }

    const { data, error, count } = await query;
    if (error) {
      // Log the full error server-side for debugging
      console.error("[api/production/batches/search] Query error:", error);
      // Return generic message to client
      return NextResponse.json({ error: "Failed to search batches" }, { status: 400 });
    }
    return NextResponse.json({
      page,
      pageSize,
      total: count ?? 0,
      items: data ?? [],
    });
  } catch (e) {
    // Log the full error server-side for debugging
    console.error("[api/production/batches/search] Error:", e);
    // Return generic message to client - don't expose internal details
    return NextResponse.json({ error: "An error occurred while searching batches" }, { status: 500 });
  }
}
