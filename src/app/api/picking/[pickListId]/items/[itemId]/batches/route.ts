import { NextRequest, NextResponse } from "next/server";
import { getAvailableBatchesForItem, substituteBatch } from "@/server/sales/picking";

// GET /api/picking/[pickListId]/items/[itemId]/batches - Get available batches for substitution
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pickListId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const batches = await getAvailableBatchesForItem(itemId);

    return NextResponse.json({ batches });
  } catch (error: any) {
    console.error("Error fetching available batches:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch available batches" },
      { status: 500 }
    );
  }
}

// POST /api/picking/[pickListId]/items/[itemId]/batches - Substitute batch
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
  } catch (error: any) {
    console.error("Error substituting batch:", error);
    return NextResponse.json(
      { error: error.message || "Failed to substitute batch" },
      { status: 500 }
    );
  }
}







