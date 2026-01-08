// src/app/api/dispatch/packing/[orderId]/route.ts
import { NextResponse } from "next/server";
import { UpdatePackingSchema } from "@/lib/dispatch/types";
import {
  getOrCreateOrderPacking,
  updateOrderPacking,
} from "@/server/dispatch/queries.server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const packing = await getOrCreateOrderPacking(orderId);
    return NextResponse.json({ ok: true, packing });
  } catch (err) {
    console.error("[api:dispatch/packing/[orderId]][GET]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const json = await req.json();
    const parsed = UpdatePackingSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await updateOrderPacking(orderId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api:dispatch/packing/[orderId]][PATCH]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
