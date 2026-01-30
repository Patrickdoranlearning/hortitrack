import { NextResponse } from "next/server";
import { getDispatchBoardData } from "@/server/dispatch/queries.server";
import { logger, getErrorMessage } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { orders } = await getDispatchBoardData();
    return NextResponse.json({ orders });
  } catch (error) {
    logger.dispatch.error("Error fetching dispatch board data", error);
    const message = getErrorMessage(error);
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

