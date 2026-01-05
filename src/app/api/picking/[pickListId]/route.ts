import { NextRequest, NextResponse } from "next/server";
import {
  getPickListById,
  startPickList,
  completePickList,
  assignPickListToTeam,
  updatePickListSequence,
} from "@/server/sales/picking";

// GET /api/picking/[pickListId] - Get pick list details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string }> }
) {
  try {
    const { pickListId } = await params;
    const pickList = await getPickListById(pickListId);

    if (!pickList) {
      return NextResponse.json(
        { error: "Pick list not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ pickList });
  } catch (error: any) {
    console.error("Error fetching pick list:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch pick list" },
      { status: 500 }
    );
  }
}

// PATCH /api/picking/[pickListId] - Update pick list (start, complete, assign, reorder)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string }> }
) {
  try {
    const { pickListId } = await params;
    const body = await request.json();
    const { action, teamId, sequence } = body;

    let result: { error?: string } = {};

    switch (action) {
      case "start":
        result = await startPickList(pickListId);
        break;
      case "complete":
        result = await completePickList(pickListId);
        break;
      case "assign":
        result = await assignPickListToTeam(pickListId, teamId);
        break;
      case "reorder":
        if (typeof sequence !== "number") {
          return NextResponse.json(
            { error: "sequence is required for reorder action" },
            { status: 400 }
          );
        }
        result = await updatePickListSequence(pickListId, sequence);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    const pickList = await getPickListById(pickListId);
    return NextResponse.json({ pickList });
  } catch (error: any) {
    console.error("Error updating pick list:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update pick list" },
      { status: 500 }
    );
  }
}





