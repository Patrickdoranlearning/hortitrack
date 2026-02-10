import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

/**
 * Worker Location Detail API
 *
 * Returns location info with all batches at this location.
 * Includes summary stats for plant health indicators.
 */

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface WorkerLocationBatch {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  familyName: string | null;
  sizeName: string | null;
  status: string | null;
  phase: string | null;
  quantity: number;
  initialQuantity: number;
  daysAtLocation: number | null;
  healthStatus: "healthy" | "warning" | "critical" | null;
  lastScoutedAt: string | null;
}

export interface WorkerLocationDetail {
  id: string;
  name: string;
  nurserySite: string | null;
  type: string | null;
  covered: boolean;
  area: number | null;
  siteId: string | null;
  batchCount: number;
  totalQuantity: number;
  batches: WorkerLocationBatch[];
  healthSummary: {
    healthy: number;
    warning: number;
    critical: number;
    notScouted: number;
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const parse = ParamsSchema.safeParse(resolvedParams);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid location ID" },
        { status: 400 }
      );
    }

    const { id: locationId } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    // Fetch location details
    const { data: location, error: locError } = await supabase
      .from("nursery_locations")
      .select("id, name, nursery_site, type, covered, area, site_id")
      .eq("id", locationId)
      .eq("org_id", orgId)
      .single();

    if (locError || !location) {
      if (locError?.code === "PGRST116") {
        return NextResponse.json(
          { error: "Location not found" },
          { status: 404 }
        );
      }
      logger.worker.error("Worker location query failed", locError);
      return NextResponse.json(
        { error: "Failed to fetch location" },
        { status: 500 }
      );
    }

    // Fetch batches at this location with variety info
    const { data: batches, error: batchError } = await supabase
      .from("batches")
      .select(`
        id,
        batch_number,
        quantity,
        initial_quantity,
        status,
        phase,
        location_changed_at,
        created_at,
        plant_varieties (
          name,
          family
        ),
        plant_sizes (
          name
        )
      `)
      .eq("org_id", orgId)
      .eq("location_id", locationId)
      .neq("status", "Archived")
      .gt("quantity", 0)
      .order("batch_number", { ascending: false });

    if (batchError) {
      logger.worker.error("Worker location batches query failed", batchError);
      return NextResponse.json(
        { error: "Failed to fetch batches" },
        { status: 500 }
      );
    }

    // Get batch IDs for health status lookup
    const batchIds = (batches ?? []).map((b) => b.id);

    // Fetch latest health flags for these batches
    const healthMap = new Map<string, { status: "healthy" | "warning" | "critical"; lastScouted: string }>();

    if (batchIds.length > 0) {
      // Get the most recent plant health log for each batch
      const { data: healthLogs, error: healthError } = await supabase
        .from("plant_health_logs")
        .select("batch_id, severity, event_at, event_type")
        .eq("org_id", orgId)
        .in("batch_id", batchIds)
        .in("event_type", ["scout_flag", "issue_flagged", "clearance"])
        .order("event_at", { ascending: false });

      if (!healthError && healthLogs) {
        // Group by batch and take the most recent
        for (const log of healthLogs) {
          if (!log.batch_id) continue;
          if (healthMap.has(log.batch_id)) continue; // Already have latest

          let status: "healthy" | "warning" | "critical" = "healthy";
          if (log.event_type === "clearance") {
            status = "healthy";
          } else if (log.severity === "critical") {
            status = "critical";
          } else if (log.severity === "medium" || log.severity === "low") {
            status = "warning";
          }

          healthMap.set(log.batch_id, {
            status,
            lastScouted: log.event_at,
          });
        }
      }
    }

    // Transform batches
    const now = new Date();
    const transformedBatches: WorkerLocationBatch[] = (batches ?? []).map((b) => {
      const health = healthMap.get(b.id);
      const locationChangedAt = b.location_changed_at || b.created_at;
      const daysAtLocation = locationChangedAt
        ? Math.floor((now.getTime() - new Date(locationChangedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const varieties = b.plant_varieties as unknown as { name: string; family: string } | null;
      const sizes = b.plant_sizes as unknown as { name: string } | null;

      return {
        id: b.id,
        batchNumber: b.batch_number,
        varietyName: varieties?.name ?? null,
        familyName: varieties?.family ?? null,
        sizeName: sizes?.name ?? null,
        status: b.status,
        phase: b.phase,
        quantity: b.quantity ?? 0,
        initialQuantity: b.initial_quantity ?? 0,
        daysAtLocation,
        healthStatus: health?.status ?? null,
        lastScoutedAt: health?.lastScouted ?? null,
      };
    });

    // Calculate health summary
    const healthSummary = {
      healthy: 0,
      warning: 0,
      critical: 0,
      notScouted: 0,
    };

    for (const batch of transformedBatches) {
      if (batch.healthStatus === "critical") {
        healthSummary.critical++;
      } else if (batch.healthStatus === "warning") {
        healthSummary.warning++;
      } else if (batch.healthStatus === "healthy") {
        healthSummary.healthy++;
      } else {
        healthSummary.notScouted++;
      }
    }

    const response: WorkerLocationDetail = {
      id: location.id,
      name: location.name,
      nurserySite: location.nursery_site,
      type: location.type,
      covered: location.covered ?? false,
      area: location.area,
      siteId: location.site_id,
      batchCount: transformedBatches.length,
      totalQuantity: transformedBatches.reduce((sum, b) => sum + b.quantity, 0),
      batches: transformedBatches,
      healthSummary,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.worker.error("Worker location detail fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching location details" },
      { status: 500 }
    );
  }
}
