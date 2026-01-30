// src/app/api/dispatch/orders/[orderId]/status/route.ts
import { NextResponse } from "next/server";
import { CreateOrderStatusUpdateSchema } from "@/lib/dispatch/types";
import {
  createOrderStatusUpdate,
  getOrderStatusUpdates,
} from "@/server/dispatch/queries.server";
import { logger, getErrorMessage } from "@/server/utils/logger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const updates = await getOrderStatusUpdates(orderId);
    return NextResponse.json({ ok: true, updates });
  } catch (err) {
    logger.dispatch.error("Error fetching order status updates", err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const json = await req.json();
    const parsed = CreateOrderStatusUpdateSchema.safeParse({
      ...json,
      orderId,
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
    logger.dispatch.error("Error creating order status update", err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
