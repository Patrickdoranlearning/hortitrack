import { NextRequest, NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";
import { type CachedReferenceData } from "@/lib/cache/reference-data";

/**
 * Returns reference data for the UI.
 * Uses the authenticated user's session to fetch data.
 */
export async function GET(_req: NextRequest) {
  const results = {
    varieties: [] as any[],
    sizes: [] as any[],
    locations: [] as any[],
    suppliers: [] as any[],
    materials: [] as any[],
    errors: [] as string[],
  };

  try {
    // Get authenticated user and their org
    const { orgId, supabase } = await getLightweightAuth();

    // Fetch reference data using user's authenticated session
    const cachedData = await fetchReferenceDataWithUserSession(supabase, orgId);

    results.varieties = cachedData.varieties;
    results.sizes = cachedData.sizes;
    results.locations = cachedData.locations;
    results.suppliers = cachedData.suppliers;
    results.materials = cachedData.materials;

  } catch (e: any) {
    const isAuthError = /Unauthenticated|No organization/i.test(e?.message);
    if (isAuthError) {
      results.errors.push(e.message);
      return NextResponse.json(results, { status: 401 });
    }
    console.error("[reference-data] error:", e);
    results.errors.push(e?.message ?? "Failed to fetch reference data");
  }

  // Add cache headers for browser/CDN caching (60 seconds)
  return NextResponse.json(results, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
    },
  });
}

/**
 * Fetch reference data using the user's authenticated session
 * Used as fallback when service_role key is not configured
 */
async function fetchReferenceDataWithUserSession(
  supabase: any,
  orgId: string
): Promise<CachedReferenceData> {
  // Run all queries in parallel using user's session
  const [varietiesRes, sizesRes, locationsRes, suppliersRes, materialsRes] = await Promise.all([
    supabase
      .from("plant_varieties")
      .select("id, name, family, genus, species, category")
      .order("name"),
    supabase
      .from("plant_sizes")
      .select("id, name, container_type, cell_multiple")
      .order("name"),
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
    supabase
      .from("materials")
      .select(`
        id,
        name,
        part_number,
        category_id,
        base_uom,
        linked_size_id,
        is_active,
        category:material_categories(name, code, parent_group)
      `)
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  // Log any errors for debugging
  if (varietiesRes.error) console.warn("[reference-data] varieties error:", varietiesRes.error.message);
  if (sizesRes.error) console.warn("[reference-data] sizes error:", sizesRes.error.message);
  if (locationsRes.error) console.warn("[reference-data] locations error:", locationsRes.error.message);
  if (suppliersRes.error) console.warn("[reference-data] suppliers error:", suppliersRes.error.message);
  if (materialsRes.error) console.warn("[reference-data] materials error:", materialsRes.error.message);

  // Transform materials to flatten category info and filter to Containers + Growing Media
  const materials = (materialsRes.data ?? [])
    .filter((m: any) => {
      const parentGroup = m.category?.parent_group;
      return parentGroup === "Containers" || parentGroup === "Growing Media";
    })
    .map((m: any) => ({
      id: m.id,
      name: m.name,
      part_number: m.part_number,
      category_id: m.category_id,
      category_name: m.category?.name ?? null,
      category_code: m.category?.code ?? null,
      parent_group: m.category?.parent_group ?? null,
      base_uom: m.base_uom,
      linked_size_id: m.linked_size_id ?? null,
      is_active: m.is_active,
    }));

  return {
    varieties: varietiesRes.data ?? [],
    sizes: sizesRes.data ?? [],
    locations: locationsRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
    materials,
  };
}
