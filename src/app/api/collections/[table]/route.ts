// src/app/api/collections/[table]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Q = z.object({
  q: z.string().trim().optional(),
  site: z.string().trim().optional(), // for nursery_locations
  limit: z.coerce.number().min(1).max(200).default(50),
});

// Only allow a known set of tables to prevent abuse
const ALLOWED = new Set([
  "batches",
  "nursery_locations",
  "suppliers",
  "plant_varieties",
  "plant_sizes",
]);

function canonicalize(tbl: string) {
  if (tbl === "locations") return "nursery_locations";
  return tbl;
}

export async function GET(req: Request, ctx: { params: { table: string } }) {
  const tableParam = canonicalize((ctx.params.table || "").toLowerCase());
  if (!ALLOWED.has(tableParam)) {
    return NextResponse.json({ rows: [] });
  }

  const { searchParams } = new URL(req.url);
  const parse = Q.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ rows: [] });

  const { q, site, limit } = parse.data;
  const supabase = getSupabaseForRequest();

  const isOrgScoped = (t: string) =>
    t === "batches" || t === "nursery_locations" || t === "suppliers";

  let activeOrgId: string | null = null;
  if (isOrgScoped(tableParam)) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ rows: [] });

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (pErr || !profile?.active_org_id) return NextResponse.json({ rows: [] });
    activeOrgId = profile.active_org_id;
  }

  try {
    if (tableParam === "batches") {
      // CORRECTED: Query the v_batch_search view to get rich, joined data
      let query = supabase
        .from("v_batch_search")
        .select("*") // The view is designed to return all necessary display columns
        .eq("org_id", activeOrgId!)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (q) {
        // The view contains searchable text fields
        query = query.or(`batch_number.ilike.%${q}%,variety_name.ilike.%${q}%,location_name.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] });
    }

    if (tableParam === "nursery_locations") {
      let query = supabase
        .from("nursery_locations")
        .select("id,name,nursery_site,covered,org_id,created_at")
        .eq("org_id", activeOrgId!)
        .order("name", { ascending: true });

      if (site) query = query.eq("nursery_site", site);
      if (q) query = query.ilike("name", `%${q}%`);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ rows: (data ?? []).slice(0, limit) });
    }

    if (tableParam === "suppliers") {
      let query = supabase
        .from("suppliers")
        .select("id,name,producer_code,country_code,org_id,created_at")
        .eq("org_id", activeOrgId!)
        .order("name", { ascending: true })
        .limit(limit);

      if (q) query = query.ilike("name", `%${q}%`);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] });
    }

    if (tableParam === "plant_varieties") {
      let query = supabase
        .from("plant_varieties")
        .select("id,name,family,created_at")
        .order("name", { ascending: true })
        .limit(limit);

      if (q) query = query.ilike("name", `%${q}%`);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] });
    }

    if (tableParam === "plant_sizes") {
      let query = supabase
        .from("plant_sizes")
        .select("id,name,container_type,cell_multiple,created_at")
        .order("name", { ascending: true })
        .limit(limit);

      if (q) query = query.or(`name.ilike.%${q}%,container_type.ilike.%${q}%`);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ rows: data ?? [] });
    }

    return NextResponse.json({ rows: [] });
  } catch (error) {
    console.error(`[collections.${tableParam}]`, error);
    return NextResponse.json({ rows: [] });
  }
}