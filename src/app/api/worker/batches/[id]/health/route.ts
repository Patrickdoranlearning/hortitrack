import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

/**
 * Worker Batch Health API
 *
 * Returns health logs for a specific batch including treatments, measurements, and issues.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    // Get health logs for this batch
    const { data, error } = await supabase
      .from("plant_health_logs")
      .select(`
        id,
        event_type,
        event_at,
        product_name,
        rate,
        unit,
        method,
        ec_reading,
        ph_reading,
        issue_reason,
        severity,
        notes
      `)
      .eq("org_id", orgId)
      .eq("batch_id", id)
      .order("event_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[api/worker/batches/[id]/health] Query error:", error);
      return NextResponse.json(
        { error: "Failed to load health logs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs: data || [] });
  } catch (error) {
    console.error("[api/worker/batches/[id]/health] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load health data" },
      { status: 500 }
    );
  }
}
