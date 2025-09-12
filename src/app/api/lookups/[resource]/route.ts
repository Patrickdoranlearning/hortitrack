// app/api/lookups/[resource]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Resource = z.enum(["varieties", "sizes", "locations", "suppliers"]);

function cache(resp: NextResponse) {
  // CDN cache; instant feel for users; background revalidate
  resp.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return resp;
}

async function getOrgId(req: Request, supabase: ReturnType<typeof getSupabaseForRequest>) {
  // Prefer explicit query param or header before consulting the user's profile
  const url = new URL(req.url);
  const byParam = url.searchParams.get("org");
  if (byParam) return byParam;

  const hdr = (await import("next/headers")).headers();
  const byHeader = hdr.get("x-org-id");
  if (byHeader) return byHeader;

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.user.id)
    .single();
  if (error) return null;
  return profile?.active_org_id ?? null;
}

export async function GET(req: Request, ctx: { params: { resource: string } }) {
  const parse = Resource.safeParse(ctx.params.resource);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  }

  const resource = parse.data;
  const supabase = getSupabaseForRequest();
  try {
    let data: any[] = [];
    switch (resource) {
      case "varieties": {
        const { data: rows, error } = await supabase
          .from("lookup_varieties")
          .select("id, name, family, genus, species, category")
          .order("name", { ascending: true })
          .limit(2000); // safe upper bound; adjust if needed
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "sizes": {
        const { data: rows, error } = await supabase
          .from("lookup_sizes")
          .select("id, name, container_type, cell_multiple")
          .order("name", { ascending: true });
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "locations": {
        const orgId = await getOrgId(req, supabase);
        if (!orgId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        const { data: rows, error } = await supabase
          .from("lookup_locations")
          .select("id, name, nursery_site, covered")
          .eq("org_id", orgId)
          .order("name", { ascending: true })
          .limit(1000);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "suppliers": {
        const orgId = await getOrgId(req, supabase);
        if (!orgId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        const { data: rows, error } = await supabase
          .from("lookup_suppliers")
          .select("id, name, producer_code, country_code")
          .eq("org_id", orgId)
          .order("name", { ascending: true })
          .limit(1000);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
    }
    return cache(NextResponse.json({ data, items: data }));
  } catch (e: any) {
    console.error("[lookups] error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Lookup failed" },
      { status: 500 }
    );
  }
}
