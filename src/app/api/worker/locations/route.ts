import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import type { WorkerLocation, WorkerLocationsResponse } from "@/types/worker";

/**
 * Worker Locations API
 *
 * Mobile-optimized endpoint for listing locations with batch counts.
 * Returns compact location data suitable for worker app cards.
 */

const QuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.string().optional(),
  nurserySite: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parse = QuerySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parse.error.flatten() },
        { status: 400 }
      );
    }

    const { q, type, nurserySite } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    // Fetch all locations with batch counts using a subquery
    let locationsQuery = supabase
      .from("nursery_locations")
      .select("id, name, nursery_site, type, covered, area, site_id")
      .eq("org_id", orgId)
      .order("name");

    // Apply filters
    if (type) {
      locationsQuery = locationsQuery.eq("type", type);
    }
    if (nurserySite) {
      locationsQuery = locationsQuery.eq("nursery_site", nurserySite);
    }
    if (q && q.length > 0) {
      locationsQuery = locationsQuery.ilike("name", `%${q}%`);
    }

    const { data: locations, error: locError } = await locationsQuery;

    if (locError) {
      logger.worker.error("Worker locations query failed", locError);
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 }
      );
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // Get batch counts for all locations in a single query
    const locationIds = locations.map((l) => l.id);
    const { data: batchStats, error: batchError } = await supabase
      .from("batches")
      .select("location_id, quantity")
      .eq("org_id", orgId)
      .in("location_id", locationIds)
      .neq("status", "Archived")
      .gt("quantity", 0);

    if (batchError) {
      logger.worker.error("Worker locations batch stats query failed", batchError);
    }

    // Aggregate batch counts by location
    const batchCountMap = new Map<string, { count: number; quantity: number }>();
    for (const batch of batchStats ?? []) {
      if (!batch.location_id) continue;
      const existing = batchCountMap.get(batch.location_id) ?? { count: 0, quantity: 0 };
      batchCountMap.set(batch.location_id, {
        count: existing.count + 1,
        quantity: existing.quantity + (batch.quantity ?? 0),
      });
    }

    // Transform to response format
    const items: WorkerLocation[] = locations.map((loc) => {
      const stats = batchCountMap.get(loc.id) ?? { count: 0, quantity: 0 };
      // Calculate capacity percent if area is known (rough estimate: 10 plants per m2)
      const capacityPercent = loc.area
        ? Math.min(100, Math.round((stats.quantity / (loc.area * 10)) * 100))
        : null;

      return {
        id: loc.id,
        name: loc.name,
        nurserySite: loc.nursery_site,
        type: loc.type,
        covered: loc.covered ?? false,
        area: loc.area,
        siteId: loc.site_id,
        batchCount: stats.count,
        totalQuantity: stats.quantity,
        capacityPercent,
      };
    });

    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (error) {
    logger.worker.error("Worker locations fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching locations" },
      { status: 500 }
    );
  }
}
