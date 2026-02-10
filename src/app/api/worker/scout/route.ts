import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import type {
  WorkerScoutLog,
  WorkerScoutStats,
  GetScoutsResponse,
} from "@/types/worker";

/**
 * Worker Scout API
 *
 * GET: Returns recent scouts by the current user (today's scouts)
 * POST: Creates a new scout log entry
 */

const CreateScoutSchema = z.object({
  batchId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  issueType: z.enum(["pest", "disease", "nutrient", "water", "environmental", "other"]).optional(),
  severity: z.enum(["low", "medium", "critical"]).default("medium"),
  affectedPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
  isAllClear: z.boolean().default(false),
}).refine(
  (data) => data.batchId || data.locationId,
  { message: "Either batchId or locationId is required" }
);

// GET - List recent scouts
export async function GET(_req: NextRequest) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();

    // Get today's date bounds
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    // Fetch today's scouts by this user
    const { data: scouts, error: scoutError } = await supabase
      .from("plant_health_logs")
      .select(`
        id,
        batch_id,
        location_id,
        event_type,
        issue_reason,
        severity,
        notes,
        photo_url,
        event_at,
        batches!left (
          batch_number,
          plant_varieties (name)
        ),
        nursery_locations!left (name)
      `)
      .eq("org_id", orgId)
      .eq("recorded_by", user.id)
      .gte("event_at", todayStart)
      .in("event_type", ["scout_flag", "issue_flagged", "clearance", "measurement"])
      .order("event_at", { ascending: false })
      .limit(50);

    if (scoutError) {
      logger.worker.error("Scout query failed", scoutError);
      return NextResponse.json(
        { error: "Failed to fetch scouts" },
        { status: 500 }
      );
    }

    // Transform results
    const transformedScouts: WorkerScoutLog[] = (scouts ?? []).map((s) => {
      const batch = s.batches as unknown as { batch_number: string; plant_varieties: { name: string } | null } | null;
      const location = s.nursery_locations as unknown as { name: string } | null;

      return {
        id: s.id,
        batchId: s.batch_id,
        batchNumber: batch?.batch_number ?? null,
        varietyName: batch?.plant_varieties?.name ?? null,
        locationId: s.location_id,
        locationName: location?.name ?? null,
        issueType: s.issue_reason,
        severity: s.severity,
        affectedPercent: null, // Not stored in current schema
        notes: s.notes,
        photoUrl: s.photo_url,
        isAllClear: s.event_type === "clearance",
        createdAt: s.event_at,
      };
    });

    // Calculate stats
    const stats: WorkerScoutStats = {
      scoutedToday: transformedScouts.length,
      issuesFoundToday: transformedScouts.filter((s) => s.issueType && !s.isAllClear).length,
    };

    const response: GetScoutsResponse = {
      scouts: transformedScouts,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.worker.error("Scout operation failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching scouts" },
      { status: 500 }
    );
  }
}

// POST - Create new scout log
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = CreateScoutSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parse.error.flatten() },
        { status: 400 }
      );
    }

    const input = parse.data;
    const { supabase, orgId, user } = await getUserAndOrg();

    // Determine event type
    let eventType: string;
    if (input.isAllClear) {
      eventType = "clearance";
    } else if (input.issueType) {
      eventType = "scout_flag";
    } else {
      eventType = "scout_flag"; // Default to scout_flag
    }

    // Build the insert data
    const insertData = {
      org_id: orgId,
      batch_id: input.batchId || null,
      location_id: input.locationId || null,
      event_type: eventType,
      issue_reason: input.isAllClear ? null : input.issueType,
      severity: input.isAllClear ? null : input.severity,
      notes: input.notes || null,
      photo_url: input.photoUrl || null,
      recorded_by: user.id,
      event_at: new Date().toISOString(),
    };

    const { data, error: insertError } = await supabase
      .from("plant_health_logs")
      .insert(insertData)
      .select("id")
      .single();

    if (insertError) {
      logger.worker.error("Scout log insert failed", insertError);
      return NextResponse.json(
        { error: "Failed to create scout log" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    logger.worker.error("Scout operation failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while creating scout log" },
      { status: 500 }
    );
  }
}
