import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getProductionHealthSummary } from "@/server/batches/health-status";
import { logger } from "@/server/utils/logger";

/**
 * GET /api/production/health-summary
 * Returns production health summary stats
 */
export async function GET() {
  try {
    const { orgId } = await getUserAndOrg();
    const summary = await getProductionHealthSummary(orgId);

    return NextResponse.json(summary);
  } catch (error) {
    logger.production.error("Failed to fetch health summary", error);
    return NextResponse.json(
      { error: "Failed to fetch health summary" },
      { status: 500 }
    );
  }
}
