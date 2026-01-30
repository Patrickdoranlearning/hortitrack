// src/app/api/dispatch/runs/route.ts
import { NextResponse } from "next/server";
import { CreateDeliveryRunSchema } from "@/lib/dispatch/types";
import {
  listDeliveryRuns,
  createDeliveryRun,
  getActiveDeliveryRuns,
} from "@/server/dispatch/queries.server";
import { logger, getErrorMessage } from "@/server/utils/logger";

interface DeliveryRunFilters {
  status?: string;
  runDate?: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const runDate = searchParams.get("runDate");
    const active = searchParams.get("active");

    // If requesting active runs, use the view-based query
    if (active === "true") {
      const runs = await getActiveDeliveryRuns();
      return NextResponse.json({ ok: true, runs });
    }

    const filters: DeliveryRunFilters = {};
    if (status) filters.status = status;
    if (runDate) filters.runDate = runDate;

    const runs = await listDeliveryRuns(filters);
    return NextResponse.json({ ok: true, runs });
  } catch (err) {
    logger.dispatch.error("Error listing delivery runs", err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CreateDeliveryRunSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = await createDeliveryRun(parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    logger.dispatch.error("Error creating delivery run", err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
