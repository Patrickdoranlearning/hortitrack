import "server-only";
import { NextResponse } from "next/server";
import { getLightweightAuth } from "@/lib/auth/lightweight";
import { logger } from "@/server/utils/logger";

/**
 * Combined reference data endpoint for batch creation forms.
 *
 * Returns varieties, sizes, and locations in a single request.
 * Used by the worker batch create (check-in) page.
 */
export async function GET() {
  try {
    const { orgId, supabase } = await getLightweightAuth();

    // Fetch all reference data in parallel
    const [varietiesResult, sizesResult, locationsResult] = await Promise.all([
      // Varieties - use the compat view for consistent access
      supabase
        .from("plant_varieties_compat")
        .select("id, name, family, genus, species, category")
        .order("name")
        .limit(2000),

      // Sizes - org-specific plant sizes
      supabase
        .from("plant_sizes")
        .select("id, name, container_type, cell_multiple")
        .eq("org_id", orgId)
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
    logger.api.error("Catalog reference data lookup failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
