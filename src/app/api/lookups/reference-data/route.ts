import "server-only";
import { NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";
import { logger } from "@/server/utils/logger";

/**
 * Combined reference data endpoint for worker app forms.
 *
 * Returns varieties, sizes, and locations in a single request.
 * Used by PropagationForm and TransplantWizard pages.
 */
export async function GET() {
  try {
    const { orgId, supabase } = await getLightweightAuth();

    // Fetch all reference data in parallel
    const [varietiesResult, sizesResult, locationsResult] = await Promise.all([
      // Varieties - use the lookup view that has merged data
      supabase
        .from("lookup_varieties")
        .select("id, name, family, genus, species, category")
        .order("name")
        .limit(2000),

      // Sizes - includes cell_multiple for quantity calculations
      supabase
        .from("lookup_sizes")
        .select("id, name, container_type, cell_multiple")
        .order("name"),

      // Locations - org-specific
      supabase
        .from("nursery_locations")
        .select("id, name, nursery_site, covered, type")
        .eq("org_id", orgId)
        .order("name")
        .limit(1000),
    ]);

    // Check for errors
    if (varietiesResult.error) {
      logger.api.error("Failed to fetch varieties", varietiesResult.error);
      throw new Error("Failed to fetch varieties");
    }
    if (sizesResult.error) {
      logger.api.error("Failed to fetch sizes", sizesResult.error);
      throw new Error("Failed to fetch sizes");
    }
    if (locationsResult.error) {
      logger.api.error("Failed to fetch locations", locationsResult.error);
      throw new Error("Failed to fetch locations");
    }

    return NextResponse.json(
      {
        varieties: varietiesResult.data ?? [],
        sizes: sizesResult.data ?? [],
        locations: locationsResult.data ?? [],
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    const status = /Unauthenticated|No organization/i.test(message) ? 401 : 500;
    logger.api.error("Reference data lookup failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
