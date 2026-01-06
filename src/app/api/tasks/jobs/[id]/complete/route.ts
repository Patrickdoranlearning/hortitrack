import { NextResponse } from "next/server";
import { z } from "zod";
import { completeJob } from "@/server/production/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CompleteJobSchema = z.object({
  wizardData: z.record(z.unknown()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = CompleteJobSchema.parse(body);

    const job = await completeJob(id, input.wizardData);

    return NextResponse.json({ job });
  } catch (error: unknown) {
    console.error("[api/tasks/jobs/[id]/complete] POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to complete job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}





