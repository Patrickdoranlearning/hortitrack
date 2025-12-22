import { NextRequest, NextResponse } from "next/server";
import { getPickListsForTeam } from "@/server/sales/picking";

// GET /api/picking/teams/[teamId] - Get team's pick lists
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    
    const statusParam = searchParams.get("status");
    const statuses = statusParam ? statusParam.split(",") as any[] : ["pending", "in_progress"];

    const pickLists = await getPickListsForTeam(teamId, statuses);

    return NextResponse.json({ pickLists });
  } catch (error: any) {
    console.error("Error fetching team pick lists:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch team pick lists" },
      { status: 500 }
    );
  }
}




