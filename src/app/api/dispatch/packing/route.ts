// src/app/api/dispatch/packing/route.ts
import { NextResponse } from "next/server";
import { getOrdersReadyForDispatch } from "@/server/dispatch/queries.server";

export async function GET(req: Request) {
  try {
    const orders = await getOrdersReadyForDispatch();
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[api:dispatch/packing][GET]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
