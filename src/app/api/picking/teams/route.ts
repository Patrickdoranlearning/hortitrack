import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getPickingTeams,
  createPickingTeam,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  getUserTeams,
} from "@/server/sales/picking";

// GET /api/picking/teams - List picking teams
export async function GET(request: NextRequest) {
  try {
    const { orgId, user } = await getUserAndOrg();
    const { searchParams } = new URL(request.url);
    
    const myTeams = searchParams.get("my") === "true";

    if (myTeams) {
      const teams = await getUserTeams(user.id);
      return NextResponse.json({ teams });
    }

    const teams = await getPickingTeams(orgId);
    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error("Error fetching picking teams:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch picking teams" },
      { status: 500 }
    );
  }
}

// POST /api/picking/teams - Create a new picking team
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const result = await createPickingTeam(orgId, name, description);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ team: result.team }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating picking team:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create picking team" },
      { status: 500 }
    );
  }
}





