import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getPendingTransfers,
  getTransferHistory,
  getPendingTransferCount,
  requestBalanceTransfer,
} from "@/server/dispatch/balance-transfers.server";
import { logger } from "@/server/utils/logger";

/**
 * GET /api/dispatch/trolleys/transfers
 * Get pending transfers or transfer history
 *
 * Query params:
 * - status: "pending" | "history" | "count"
 * - limit: number (for history)
 */
export async function GET(request: Request) {
  try {
    await getUserAndOrg();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (status === "count") {
      const count = await getPendingTransferCount();
      return NextResponse.json({ count });
    }

    if (status === "history") {
      const transfers = await getTransferHistory(limit);
      return NextResponse.json({ transfers });
    }

    // Default: pending transfers
    const transfers = await getPendingTransfers();
    return NextResponse.json({ transfers });
  } catch (error) {
    logger.trolley.error("Error fetching transfers", error);
    return NextResponse.json(
      { error: "Failed to fetch transfers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dispatch/trolleys/transfers
 * Request a new balance transfer
 */
export async function POST(request: Request) {
  try {
    await getUserAndOrg();

    const body = await request.json();

    const result = await requestBalanceTransfer({
      fromHaulierId: body.fromHaulierId,
      toCustomerId: body.toCustomerId,
      trolleys: body.trolleys || 0,
      shelves: body.shelves || 0,
      deliveryRunId: body.deliveryRunId,
      deliveryItemId: body.deliveryItemId,
      reason: body.reason || "Customer did not return trolleys",
      driverNotes: body.driverNotes,
      signedDocketUrl: body.signedDocketUrl,
      photoUrl: body.photoUrl,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
    });
  } catch (error) {
    logger.trolley.error("Error creating transfer request", error);
    return NextResponse.json(
      { error: "Failed to create transfer request" },
      { status: 500 }
    );
  }
}
