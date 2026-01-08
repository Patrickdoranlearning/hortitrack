// src/app/api/dispatch/orders/[orderId]/status/route.ts
import { NextResponse } from "next/server";
import { CreateOrderStatusUpdateSchema } from "@/lib/dispatch/types";
import {
  createOrderStatusUpdate,
  getOrderStatusUpdates,
} from "@/server/dispatch/queries.server";

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const updates = await getOrderStatusUpdates(params.orderId);
    return NextResponse.json({ ok: true, updates });
  } catch (err) {
    console.error("[api:dispatch/orders/[orderId]/status][GET]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const json = await req.json();
    const parsed = CreateOrderStatusUpdateSchema.safeParse({
      ...json,
      orderId: params.orderId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = await createOrderStatusUpdate(parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[api:dispatch/orders/[orderId]/status][POST]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
