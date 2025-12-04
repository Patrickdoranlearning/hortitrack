// src/app/api/dispatch/runs/[runId]/route.ts
import { NextResponse } from "next/server";
import {
  getDeliveryRunWithItems,
  updateDeliveryRun,
} from "@/server/dispatch/queries.server";

export async function GET(
  req: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const run = await getDeliveryRunWithItems(params.runId);

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
  { params }: { params: { runId: string } }
) {
  try {
    const json = await req.json();
    await updateDeliveryRun(params.runId, json);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api:dispatch/runs/[runId]][PATCH]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
