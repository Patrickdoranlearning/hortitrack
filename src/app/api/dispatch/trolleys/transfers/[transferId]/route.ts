import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/getUser";
import {
  approveTransfer,
  rejectTransfer,
} from "@/server/dispatch/balance-transfers.server";
import { logger, getErrorMessage } from "@/server/utils/logger";

type Params = {
  params: Promise<{
    transferId: string;
  }>;
};

/**
 * PATCH /api/dispatch/trolleys/transfers/[transferId]
 * Approve or reject a pending transfer
 *
 * Body:
 * - action: "approve" | "reject"
 * - notes: string (optional)
 *
 * Requires owner/admin role
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { transferId } = await params;

    // Require owner or admin role for approval/rejection
    const roleCheck = await requireRole(["owner", "admin"]);
    if (!roleCheck.authorized) {
      return NextResponse.json(
        { error: roleCheck.error || "Insufficient permissions" },
        { status: roleCheck.status }
      );
    }

    const body = await request.json();
    const action = body.action as "approve" | "reject";
    const notes = body.notes as string | undefined;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    let result;
    if (action === "approve") {
      result = await approveTransfer(transferId, notes);
    } else {
      result = await rejectTransfer(transferId, notes);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      transferId,
    });
  } catch (error) {
    logger.trolley.error("Error processing transfer", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
