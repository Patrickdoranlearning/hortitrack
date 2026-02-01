import { NextRequest, NextResponse } from "next/server";
import { getPickItems, updatePickItem } from "@/server/sales/picking";
import { logger, getErrorMessage } from "@/server/utils/logger";

// GET /api/picking/[pickListId]/items - Get all items for a pick list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string }> }
) {
  try {
    const { pickListId } = await params;
    const items = await getPickItems(pickListId);

    return NextResponse.json({ items });
  } catch (error) {
    logger.picking.error("Error fetching pick items", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/picking/[pickListId]/items - Update a pick item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string }> }
) {
  try {
    const body = await request.json();
    const { pickItemId, pickedQty, pickedBatchId, substitutionReason, notes, status } = body;

    if (!pickItemId) {
      return NextResponse.json(
        { error: "pickItemId is required" },
        { status: 400 }
      );
    }

    if (typeof pickedQty !== "number") {
      return NextResponse.json(
        { error: "pickedQty is required" },
        { status: 400 }
      );
    }

    const result = await updatePickItem({
      pickItemId,
      pickedQty,
      pickedBatchId,
      substitutionReason,
      notes,
      status,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Return updated items
    const { pickListId } = await params;
    const items = await getPickItems(pickListId);
    return NextResponse.json({ items });
  } catch (error) {
    logger.picking.error("Error updating pick item", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}







