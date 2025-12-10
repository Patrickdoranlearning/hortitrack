import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getPickListsForOrg,
  createPickList,
  getPickingTeams,
  createPickingTeam,
} from "@/server/sales/picking";

// GET /api/picking - List pick lists for org
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const { searchParams } = new URL(request.url);
    
    const teamId = searchParams.get("teamId") ?? undefined;
    const statusParam = searchParams.get("status");
    const statuses = statusParam ? statusParam.split(",") as any[] : undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

    const pickLists = await getPickListsForOrg(orgId, { teamId, statuses, limit });

    return NextResponse.json({ pickLists });
  } catch (error: any) {
    console.error("Error fetching pick lists:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pick lists" },
      { status: 500 }
    );
  }
}

// POST /api/picking - Create a new pick list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, teamId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const result = await createPickList({
      orderId,
      assignedTeamId: teamId,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ pickList: result.pickList }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating pick list:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create pick list" },
      { status: 500 }
    );
  }
}



