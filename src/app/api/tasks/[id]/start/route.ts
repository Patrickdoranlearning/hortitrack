import { NextResponse } from "next/server";
import { startTask } from "@/server/tasks/service";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const task = await startTask(id);

    return NextResponse.json({ task });
  } catch (error: unknown) {
    logger.api.error("Task start failed", error);
    const message = error instanceof Error ? error.message : "Failed to start task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}





