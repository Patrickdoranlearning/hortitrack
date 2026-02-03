import { NextResponse } from "next/server";
import { resetGroupsToDefaults } from "@/server/production/execution-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/production/execution-groups/reset
 * Reset all groups to defaults
 */
export async function POST() {
  try {
    const groups = await resetGroupsToDefaults();
    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset execution groups";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
