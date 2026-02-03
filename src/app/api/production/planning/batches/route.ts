import { NextResponse } from "next/server";
import { getPlanningSnapshot } from "@/server/planning/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/production/planning/batches
 * Get ghost batches (Incoming and Planned) for execution planning
 */
export async function GET() {
  try {
    const snapshot = await getPlanningSnapshot();
    // Filter to just ghost batches for execution page
    const batches = snapshot.batches.filter((b) => b.isGhost);
    return NextResponse.json({ batches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load planning batches";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
