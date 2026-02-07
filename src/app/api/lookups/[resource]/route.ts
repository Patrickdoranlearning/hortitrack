// app/api/lookups/[resource]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/utils/logger";

const Resource = z.enum(["varieties", "sizes", "locations", "suppliers", "customers"]);

function cache(resp: NextResponse) {
  // CDN cache; instant feel for users; background revalidate
  resp.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return resp;
}

/**
 * Get the organization ID for the request.
 *
 * SECURITY: The x-org-id header is validated against the user's org memberships
 * to prevent unauthorized access to other organizations' data.
 */
async function getOrgId(supabase: SupabaseClient) {
  // First, get the authenticated user
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser?.user) return null;

  const userId = authUser.user.id;

  // Check if x-org-id header is provided
  const hdr = await headers();
  const headerOrgId = hdr.get("x-org-id");

  if (headerOrgId) {
    // SECURITY: Validate that user has membership in the requested org
    // This prevents users from accessing other orgs by spoofing the header
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", userId)
      .eq("org_id", headerOrgId)
      .maybeSingle();

    if (membership) {
      // User has verified access to this org
      return headerOrgId;
    }
    // Header org_id not valid for this user - fall through to profile lookup
  }

  // Fallback to user's active_org_id from profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single();

  if (error) return null;
  return profile?.active_org_id ?? null;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource: rawResource } = await params;
  const parse = Resource.safeParse(rawResource);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  }

  const resource = parse.data;
  const supabase = await createClient();
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
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        const { data: rows, error } = await supabase
          .from("lookup_locations")
          .select("id, name, nursery_site, covered, is_virtual")
          .eq("org_id", orgId)
          .order("name", { ascending: true })
          .limit(1000);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "suppliers": {
        const orgId = await getOrgId(supabase);
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
      case "customers": {
        const orgId = await getOrgId(supabase);
        if (!orgId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
        const { data: rows, error } = await supabase
          .from("customers")
          .select("id, name")
          .eq("org_id", orgId)
          .order("name", { ascending: true })
          .limit(1000);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
    }
    return cache(NextResponse.json({ data }));
  } catch (e: unknown) {
    logger.api.error("Lookup failed", e, { resource });
    const message = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
