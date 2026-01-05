import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { reorderPickLists } from "@/server/sales/picking";

// POST /api/picking/reorder - Reorder pick lists
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const body = await request.json();
    const { teamId, orderedIds } = body;

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: "orderedIds array is required" },
        { status: 400 }
      );
    }

    const result = await reorderPickLists(orgId, teamId || null, orderedIds);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error reordering pick lists:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reorder pick lists" },
      { status: 500 }
    );
  }
}





