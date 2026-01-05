import { NextResponse } from "next/server";
import { getAssignableStaff } from "@/server/tasks/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getAssignableStaff();

    return NextResponse.json({ staff });
  } catch (error: unknown) {
    console.error("[api/tasks/staff] GET error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch staff";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}



