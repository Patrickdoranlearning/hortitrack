import { NextRequest, NextResponse } from "next/server";
import { getPickListsForTeam, type PickListStatus } from "@/server/sales/picking";
import { logger, getErrorMessage } from "@/server/utils/logger";

// GET /api/picking/teams/[teamId] - Get team's pick lists
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    
    const statusParam = searchParams.get("status");
    const statuses: PickListStatus[] = statusParam
      ? statusParam.split(",") as PickListStatus[]
      : ["pending", "in_progress"];

    const pickLists = await getPickListsForTeam(teamId, statuses);

    return NextResponse.json({ pickLists });
  } catch (error) {
    logger.picking.error("Error fetching team pick lists", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}







