// src/app/api/dispatch/packing/route.ts
import { NextResponse } from "next/server";
import { getOrdersReadyForDispatch } from "@/server/dispatch/queries.server";
import { logger, getErrorMessage } from "@/server/utils/logger";

export async function GET() {
  try {
    // getOrdersReadyForDispatch calls getUserAndOrg() which throws if not authenticated
    const orders = await getOrdersReadyForDispatch();
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    const message = getErrorMessage(err);

    // Handle authentication errors
    if (message === "Unauthenticated" || message === "No active org selected") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    logger.dispatch.error("Error fetching packing orders", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
