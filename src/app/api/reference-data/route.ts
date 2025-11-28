import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/server/db/supabaseServer";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import { getUserAndOrg } from "@/server/auth/org";

/**
 * Returns reference data for the UI.
 * - Varieties & Sizes: available to public/auth (RLS allows read).
 * - Locations & Suppliers: only when authenticated (org-scoped).
 * Never uses a service-role key.
 */
export async function GET(_req: NextRequest) {
  const supabase = await getSupabaseServerClient();

  // Try to detect a user; if none, we'll skip org-scoped queries
  const { data: userWrap } = await supabase.auth.getUser();
  const user = userWrap?.user ?? null;

  const results = {
    varieties: [] as any[],
    sizes: [] as any[],
    locations: [] as any[],
    suppliers: [] as any[],
    errors: [] as string[],
  };

  // Public/auth: varieties (compat view so "category" exists) & sizes
  {
    const { data, error } = await supabase
      .from("plant_varieties_compat")
      .select("id, name, family, genus, species, category")
      .order("name");
    if (error) results.errors.push(`varieties: ${error.message}`);
    else results.varieties = data ?? [];
  }
  {
    const { data, error } = await supabase
      .from("plant_sizes")
      .select("id, name, container_type, cell_multiple")
      .order("name");
    if (error) results.errors.push(`sizes: ${error.message}`);
    else results.sizes = data ?? [];
  }

  // Org-scoped only if authenticated
  if (user) {
    try {
      const { supabase: supScoped, orgId } = await getUserAndOrg();
      const [{ data: locs, error: lErr }, { data: sups, error: sErr }] = await Promise.all([
        supScoped
          .from("nursery_locations")
          .select("id, name, covered, area, nursery_site")
          .eq("org_id", orgId)
          .order("name"),
        supScoped
          .from("suppliers")
          .select("id, name, producer_code, country_code")
          .eq("org_id", orgId)
          .order("name"),
      ]);

      if (lErr) results.errors.push(`locations: ${lErr.message}`); else results.locations = locs ?? [];
      if (sErr) results.errors.push(`suppliers: ${sErr.message}`); else results.suppliers = sups ?? [];
    } catch (e: any) {
      results.errors.push(e?.message ?? "No active org selected");
    }
  }

  // Developer-friendly fallback: if we still don't have locations (e.g. user not assigned to an org),
  // default to the first organization seeded in the project so the UI remains usable.
  if (results.locations.length === 0 || results.suppliers.length === 0) {
    try {
      const preferredOrgId =
        process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ||
        (await supabaseAdmin
          .from("organizations")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single()
          .then((res) => res.data?.id));

      if (preferredOrgId) {
        const [{ data: locs }, { data: sups }] = await Promise.all([
          supabaseAdmin
            .from("nursery_locations")
            .select("id, name, covered, area, nursery_site")
            .eq("org_id", preferredOrgId)
            .order("name"),
          supabaseAdmin
            .from("suppliers")
            .select("id, name, producer_code, country_code")
            .eq("org_id", preferredOrgId)
            .order("name"),
        ]);
        if (results.locations.length === 0) results.locations = locs ?? [];
        if (results.suppliers.length === 0) results.suppliers = sups ?? [];
        results.errors.push(
          "Using default organization data because no active org is associated with this user."
        );
      } else {
        results.errors.push("No organizations available to provide fallback location data.");
      }
    } catch (fallbackErr: any) {
      results.errors.push(
        `Fallback locations failed: ${fallbackErr?.message ?? String(fallbackErr)}`
      );
    }
  }

  return NextResponse.json(results, { status: 200 });
}
