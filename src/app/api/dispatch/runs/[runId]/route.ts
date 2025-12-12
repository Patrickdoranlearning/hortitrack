// src/app/api/dispatch/runs/[runId]/route.ts
import { NextResponse } from "next/server";
import {
  getDeliveryRunWithItems,
  updateDeliveryRun,
} from "@/server/dispatch/queries.server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const run = await getDeliveryRunWithItems(runId);

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Delivery run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, run });
  } catch (err) {
    console.error("[api:dispatch/runs/[runId]][GET]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const json = await req.json();
    await updateDeliveryRun(runId, json);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api:dispatch/runs/[runId]][PATCH]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
