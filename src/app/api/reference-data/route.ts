import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/server/db/supabaseServer";

/**
 * Returns reference data for the UI.
 * - Varieties & Sizes: available to public/auth (RLS allows read).
 * - Locations & Suppliers: only when authenticated (org-scoped).
 * Never uses a service-role key.
 */
export async function GET(_req: NextRequest) {
  const supabase = getSupabaseServerClient();

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
    // Resolve org id
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", user.id)
      .single();
    if (profErr || !profile?.active_org_id) {
      results.errors.push("No active org selected");
    } else {
      const orgId = profile.active_org_id as string;

      const [{ data: locs, error: lErr }, { data: sups, error: sErr }] =
        await Promise.all([
          supabase
            .from("nursery_locations")
            .select("id, name, covered, area, nursery_site")
            .eq("org_id", orgId)
            .order("name"),
          supabase
            .from("suppliers")
            .select("id, name, producer_code, country_code")
            .eq("org_id", orgId)
            .order("name"),
        ]);

      if (lErr) results.errors.push(`locations: ${lErr.message}`); else results.locations = locs ?? [];
      if (sErr) results.errors.push(`suppliers: ${sErr.message}`); else results.suppliers = sups ?? [];
    }
  } else {
    // Not signed in: keep org-scoped lists empty quietly.
    // UI can infer sign-in from empty org-scoped lists if needed.
  }

  return NextResponse.json(results, { status: 200 });
}
