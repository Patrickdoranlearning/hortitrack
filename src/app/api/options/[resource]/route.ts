import { NextResponse } from "next/server";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

/**
 * Keep it simple: always return [] or [{id,label,...}] immediately.
 * No auth lookups here — RLS will filter org-scoped tables (sites/locations/suppliers).
 */
export const dynamic = "force-dynamic"; // ensure cookies apply in dev
export const revalidate = 0;            // no caching; the UI debounces anyway

type Resource = "varieties" | "sizes" | "suppliers" | "sites" | "locations";

function qp(url: URL) {
  const q = (url.searchParams.get("q") ?? "").trim();
  const siteId = url.searchParams.get("siteId") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);
  return { q, siteId, limit };
}

function ok(body: any[], resource: string) {
  const res = NextResponse.json(body);
  res.headers.set("X-Horti-Resource", resource);
  res.headers.set("X-Horti-Count", String(body.length));
  return res;
}

function fail(resource: string, note?: string) {
  const res = NextResponse.json([]);
  res.headers.set("X-Horti-Resource", resource);
  res.headers.set("X-Horti-Count", "0");
  if (note) res.headers.set("X-Horti-Note", note);
  return res;
}

export async function GET(req: Request, { params }: { params: { resource: Resource } }) {
  const { resource } = params;
  const { q, siteId, limit } = qp(new URL(req.url));
  const supabase = getSupabaseForRequest();

  try {
    if (resource === "varieties") {
      // GLOBAL lookup — schema: public.plant_varieties (no org_id)
      let qb = supabase.from("plant_varieties")
        .select("id,name,family,genus,species")
        .order("name", { ascending: true })
        .limit(limit);
      if (q) qb = qb.or(`name.ilike.%${q}%,genus.ilike.%${q}%,species.ilike.%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      const body = (data ?? []).map(v => ({
        id: v.id, label: v.name, meta: v.family ?? v.genus ?? v.species ?? null
      }));
      return ok(body, resource);
    }

    if (resource === "sizes") {
      // GLOBAL lookup — schema: public.plant_sizes (no org_id)
      let qb = supabase.from("plant_sizes")
        .select("id,name,container_type,cell_multiple")
        .order("name", { ascending: true })
        .limit(limit);
      if (q) qb = qb.ilike("name", `%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      const body = (data ?? []).map(s => ({
        id: s.id, label: s.name, meta: s.container_type, multiple: s.cell_multiple
      }));
      return ok(body, resource);
    }

    if (resource === "suppliers") {
      // ORG-scoped — RLS restricts visibility; table has org_id.
      let qb = supabase.from("suppliers")
        .select("id,name,producer_code,country_code")
        .order("name", { ascending: true })
        .limit(limit);
      if (q) qb = qb.ilike("name", `%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      const body = (data ?? []).map(s => ({
        id: s.id, label: s.name, meta: s.producer_code ?? s.country_code ?? null
      }));
      return ok(body, resource);
    }

    if (resource === "sites") {
      // ORG-scoped — sites(org_id,name). RLS must permit via membership.
      let qb = supabase.from("sites")
        .select("id,name")
        .order("name", { ascending: true })
        .limit(limit);
      if (q) qb = qb.ilike("name", `%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      const body = (data ?? []).map(s => ({ id: s.id, label: s.name }));
      return ok(body, resource);
    }

    if (resource === "locations") {
      // ORG-scoped — nursery_locations(org_id,site_id,name). Filter by site if provided.
      let qb = supabase.from("nursery_locations")
        .select("id,name,site_id")
        .order("name", { ascending: true })
        .limit(limit);
      if (siteId) qb = qb.eq("site_id", siteId);
      if (q) qb = qb.ilike("name", `%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      const body = (data ?? []).map(l => ({ id: l.id, label: l.name, siteId: l.site_id }));
      return ok(body, resource);
    }

    return fail(resource, "unknown-resource");
  } catch (e: any) {
    console.error("[options] error", { resource, q, siteId, message: e?.message });
    return fail(resource, "query-error");
  }
}