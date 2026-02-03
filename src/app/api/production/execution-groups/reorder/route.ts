import { NextResponse } from "next/server";
import { reorderGroups } from "@/server/production/execution-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/production/execution-groups/reorder
 * Reorder execution groups by providing array of group IDs in desired order
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.groupIds)) {
      return NextResponse.json(
        { error: "groupIds must be an array of group IDs" },
        { status: 400 }
      );
    }

    const groups = await reorderGroups(body.groupIds);
    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder execution groups";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
