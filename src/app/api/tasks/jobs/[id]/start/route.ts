import { NextResponse } from "next/server";
import { startJob } from "@/server/production/jobs";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const job = await startJob(id);

    return NextResponse.json({ job });
  } catch (error: unknown) {
    logger.api.error("Job start failed", error);
    const message = error instanceof Error ? error.message : "Failed to start job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}





