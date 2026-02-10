import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

/**
 * Worker Scout Batch History API
 *
 * GET: Returns scout history for a specific batch
 */

const ParamsSchema = z.object({
  batchId: z.string().uuid(),
});

export interface ScoutHistoryEntry {
  id: string;
  eventType: string;
  issueType: string | null;
  severity: string | null;
  notes: string | null;
  photoUrl: string | null;
  recordedByName: string | null;
  eventAt: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const resolvedParams = await params;
    const parse = ParamsSchema.safeParse(resolvedParams);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid batch ID" },
        { status: 400 }
      );
    }

    const { batchId } = parse.data;
    const { supabase, orgId } = await getUserAndOrg();

    // Verify batch exists and belongs to org
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id, batch_number")
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Fetch scout history for this batch
    const { data: history, error: historyError } = await supabase
      .from("plant_health_logs")
      .select(`
        id,
        event_type,
        issue_reason,
        severity,
        notes,
        photo_url,
        event_at,
        profiles!plant_health_logs_recorded_by_fkey (display_name, full_name)
      `)
      .eq("org_id", orgId)
      .eq("batch_id", batchId)
      .in("event_type", ["scout_flag", "issue_flagged", "clearance", "measurement"])
      .order("event_at", { ascending: false })
      .limit(30);

    if (historyError) {
      logger.worker.error("Scout batch history query failed", historyError);
      return NextResponse.json(
        { error: "Failed to fetch scout history" },
        { status: 500 }
      );
    }

    // Transform results
    const entries: ScoutHistoryEntry[] = (history ?? []).map((h) => {
      const profile = h.profiles as unknown as { display_name: string | null; full_name: string | null } | null;

      return {
        id: h.id,
        eventType: h.event_type,
        issueType: h.issue_reason,
        severity: h.severity,
        notes: h.notes,
        photoUrl: h.photo_url,
        recordedByName: profile?.display_name || profile?.full_name || null,
        eventAt: h.event_at,
      };
    });

    return NextResponse.json({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      history: entries,
    });
  } catch (error) {
    logger.worker.error("Scout batch detail fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "An error occurred while fetching scout history" },
      { status: 500 }
    );
  }
}
