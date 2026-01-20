// src/app/api/dispatch/packing/route.ts
import { NextResponse } from "next/server";
import { getOrdersReadyForDispatch } from "@/server/dispatch/queries.server";

export async function GET() {
  try {
    // getOrdersReadyForDispatch calls getUserAndOrg() which throws if not authenticated
    const orders = await getOrdersReadyForDispatch();
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);

    // Handle authentication errors
    if (message === "Unauthenticated" || message === "No active org selected") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    console.error("[api:dispatch/packing][GET]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
