import { NextResponse } from "next/server";
import { getDispatchBoardData } from "@/server/dispatch/queries.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { orders } = await getDispatchBoardData();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[api/dispatch/board] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch dispatch board data";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

