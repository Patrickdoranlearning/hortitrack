import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getBatchHealthStatuses } from "@/server/batches/health-status";

/**
 * GET /api/production/batches/health-status?batchIds=id1,id2,id3
 * Returns health status for multiple batches
 */
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const { searchParams } = new URL(request.url);
    const batchIdsParam = searchParams.get("batchIds");

    if (!batchIdsParam) {
      return NextResponse.json(
        { error: "batchIds parameter is required" },
        { status: 400 }
      );
    }

    const batchIds = batchIdsParam.split(",").filter(Boolean);

    if (batchIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Limit to 100 batches per request
    if (batchIds.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 batch IDs per request" },
        { status: 400 }
      );
    }

    const statusMap = await getBatchHealthStatuses(batchIds, orgId);

    // Convert Map to object for JSON response
    const statuses: Record<string, ReturnType<typeof statusMap.get>> = {};
    for (const [id, status] of statusMap) {
      statuses[id] = status;
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("[health-status] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch health statuses" },
      { status: 500 }
    );
  }
}
