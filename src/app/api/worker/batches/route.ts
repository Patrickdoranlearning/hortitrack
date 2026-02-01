import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { safeIlikePattern } from "@/server/db/sanitize";
import { logger } from "@/server/utils/logger";
import { getBatchHealthStatuses } from "@/server/batches/health-status";
import type { WorkerBatch } from "@/types/worker";

/**
 * Worker Batch Search API
 *
 * Mobile-optimized endpoint for searching batches.
 * Returns compact batch data suitable for worker app cards.
 * Optionally includes health status data for batch health indicators.
 */

const QuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  locationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  includeHealth: z.coerce.boolean().optional().default(false),
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

    const { q, status, locationId, page, pageSize, includeHealth } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build query using the v_batch_search view for optimized search
    let query = supabase
      .from("v_batch_search")
      .select(
        `id, batch_number, variety_name, family, size_name,
         location_id, location_name, status, phase,
         quantity, initial_quantity`,
        { count: "planned" }
      )
      .eq("org_id", orgId)
      .neq("status", "Archived") // Exclude archived by default for workers
      .order("batch_number", { ascending: false })
      .range(from, to);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    if (q && q.length > 0) {
      const pattern = safeIlikePattern(q.toLowerCase());
      query = query.or([
        `batch_number.ilike.${pattern}`,
        `variety_name.ilike.${pattern}`,
        `size_name.ilike.${pattern}`,
        `location_name.ilike.${pattern}`,
      ].join(","));
    }

    const { data, error, count } = await query;

    if (error) {
      logger.worker.error("Batches query failed", error, { q, status, locationId });
      return NextResponse.json(
        { error: "Failed to search batches" },
        { status: 500 }
      );
    }

    // Optionally fetch health status for all batches
    const batchIds = (data ?? []).map((row) => row.id);
    const healthStatuses = includeHealth && batchIds.length > 0
      ? await getBatchHealthStatuses(batchIds, orgId)
      : new Map();

    // Transform to camelCase for frontend
    const items: WorkerBatch[] = (data ?? []).map((row) => {
      const healthStatus = healthStatuses.get(row.id);
      return {
        id: row.id,
        batchNumber: row.batch_number,
        varietyName: row.variety_name,
        familyName: row.family,
        sizeName: row.size_name,
        locationId: row.location_id,
        locationName: row.location_name,
        status: row.status,
        phase: row.phase,
        quantity: row.quantity ?? 0,
        initialQuantity: row.initial_quantity ?? 0,
        // Health status fields (optional)
        healthLevel: healthStatus?.level,
        activeIssuesCount: healthStatus?.activeIssuesCount,
      };
    });

    return NextResponse.json({
      page,
      pageSize,
      total: count ?? 0,
      items,
    });
  } catch (error) {
    logger.worker.error("Batches endpoint error", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while searching batches" },
      { status: 500 }
    );
  }
}
