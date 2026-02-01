import { NextRequest, NextResponse } from "next/server";
import {
  getAvailableBatchesForItem,
  substituteBatch,
  pickItemMultiBatch,
  getBatchPicksForItem,
  removeBatchPick,
} from "@/server/sales/picking";
import { logger, getErrorMessage } from "@/server/utils/logger";

// GET /api/picking/[pickListId]/items/[itemId]/batches - Get available batches and current picks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const url = new URL(request.url);
    const includePicks = url.searchParams.get("includePicks") === "true";

    const batches = await getAvailableBatchesForItem(itemId);

    // Optionally include current batch picks for multi-batch picking UI
    let picks;
    if (includePicks) {
      picks = await getBatchPicksForItem(itemId);
    }

    return NextResponse.json({ batches, picks });
  } catch (error) {
    logger.picking.error("Error fetching available batches", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// POST /api/picking/[pickListId]/items/[itemId]/batches - Substitute batch (legacy single-batch)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { batchId, reason } = body;

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId is required" },
        { status: 400 }
      );
    }

    const result = await substituteBatch(itemId, batchId, reason || "");

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.picking.error("Error substituting batch", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// PUT /api/picking/[pickListId]/items/[itemId]/batches - Multi-batch pick
// Body: { batches: [{ batchId: string, quantity: number }, ...], notes?: string }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { batches, notes } = body;

    if (!batches || !Array.isArray(batches) || batches.length === 0) {
      return NextResponse.json(
        { error: "batches array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate batch entries
    for (const batch of batches) {
      if (!batch.batchId || typeof batch.quantity !== "number" || batch.quantity <= 0) {
        return NextResponse.json(
          { error: "Each batch must have a valid batchId and quantity > 0" },
          { status: 400 }
        );
      }
    }

    const result = await pickItemMultiBatch({
      pickItemId: itemId,
      batches,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      pickedQty: result.pickedQty,
    });
  } catch (error) {
    logger.picking.error("Error in multi-batch pick", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/picking/[pickListId]/items/[itemId]/batches?pickId=xxx - Remove a batch pick
export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: Promise<{ pickListId: string; itemId: string }> }
) {
  try {
    const url = new URL(request.url);
    const pickId = url.searchParams.get("pickId");

    if (!pickId) {
      return NextResponse.json(
        { error: "pickId query parameter is required" },
        { status: 400 }
      );
    }

    const result = await removeBatchPick(pickId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.picking.error("Error removing batch pick", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}







