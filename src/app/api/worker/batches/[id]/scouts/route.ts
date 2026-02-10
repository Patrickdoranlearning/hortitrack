import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

/**
 * Worker Batch Scout History API
 *
 * Returns scout observations for a specific batch.
 */

interface ScoutLog {
  id: string;
  logType: "issue" | "reading" | "all_clear";
  issueType?: string;
  severity?: "low" | "medium" | "critical";
  ecReading?: number;
  phReading?: number;
  notes?: string;
  photoUrl?: string;
  recordedBy?: string;
  recordedByName?: string;
  createdAt: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    // Get scout logs for this batch - filter to scout-relevant event types
    const { data, error } = await supabase
      .from("plant_health_logs")
      .select(`
        id,
        event_type,
        event_at,
        issue_reason,
        severity,
        ec_reading,
        ph_reading,
        notes,
        photo_url,
        recorded_by,
        profiles!plant_health_logs_recorded_by_fkey(full_name)
      `)
      .eq("org_id", orgId)
      .eq("batch_id", id)
      .in("event_type", ["issue_flagged", "measurement", "all_clear"])
      .order("event_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.worker.error("Batch scouts query failed", error);
      return NextResponse.json(
        { error: "Failed to load scout logs" },
        { status: 500 }
      );
    }

    // Transform to match expected format
    const logs: ScoutLog[] = (data || []).map((row) => {
      const profiles = row.profiles as { full_name?: string } | null;

      let logType: ScoutLog["logType"];
      if (row.event_type === "measurement") {
        logType = "reading";
      } else if (row.event_type === "all_clear") {
        logType = "all_clear";
      } else {
        logType = "issue";
      }

      return {
        id: row.id,
        logType,
        issueType: row.issue_reason || undefined,
        severity: row.severity as ScoutLog["severity"] | undefined,
        ecReading: row.ec_reading || undefined,
        phReading: row.ph_reading || undefined,
        notes: row.notes || undefined,
        photoUrl: row.photo_url || undefined,
        recordedBy: row.recorded_by || undefined,
        recordedByName: profiles?.full_name || undefined,
        createdAt: row.event_at,
      };
    });

    return NextResponse.json({ logs });
  } catch (error) {
    logger.worker.error("Batch scouts fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load scout data" },
      { status: 500 }
    );
  }
}
