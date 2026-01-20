import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { requireRole } from "@/server/auth/getUser";
import {
  approveTransfer,
  rejectTransfer,
} from "@/server/dispatch/balance-transfers.server";

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
 * Requires manager/admin role
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { transferId } = await params;
    const { user, orgId, supabase } = await getUserAndOrg();

    // Require manager or admin role for approval/rejection
    const roleCheck = await requireRole(supabase, orgId, user.id, [
      "owner",
      "admin",
      "manager",
    ]);
    if (!roleCheck.allowed) {
      return NextResponse.json(
        { error: "Insufficient permissions. Manager or admin role required." },
        { status: 403 }
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
  } catch (error: any) {
    console.error("Error processing transfer:", error);
    return NextResponse.json(
      { error: "Failed to process transfer" },
      { status: 500 }
    );
  }
}
