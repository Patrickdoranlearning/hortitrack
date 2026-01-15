// src/app/api/dispatch/runs/[runId]/items/route.ts
import { NextResponse } from "next/server";
import { AddToDeliveryRunSchema } from "@/lib/dispatch/types";
import { addOrderToDeliveryRun } from "@/server/dispatch/queries.server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const json = await req.json();
    const parsed = AddToDeliveryRunSchema.safeParse({
      ...json,
      deliveryRunId: runId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = await addOrderToDeliveryRun(parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[api:dispatch/runs/[runId]/items][POST]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
