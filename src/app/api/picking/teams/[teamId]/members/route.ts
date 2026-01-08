import { NextRequest, NextResponse } from "next/server";
import {
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
} from "@/server/sales/picking";

// GET /api/picking/teams/[teamId]/members - Get team members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const members = await getTeamMembers(teamId);

    return NextResponse.json({ members });
  } catch (error: any) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch team members" },
      { status: 500 }
    );
  }
}

// POST /api/picking/teams/[teamId]/members - Add team member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const { userId, isLead } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const result = await addTeamMember(teamId, userId, isLead);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const members = await getTeamMembers(teamId);
    return NextResponse.json({ members }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding team member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add team member" },
      { status: 500 }
    );
  }
}

// DELETE /api/picking/teams/[teamId]/members - Remove team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const result = await removeTeamMember(teamId, userId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove team member" },
      { status: 500 }
    );
  }
}







