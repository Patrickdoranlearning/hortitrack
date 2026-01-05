import { NextResponse } from "next/server";
import { z } from "zod";
import { assignJob } from "@/server/production/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AssignJobSchema = z.object({
  assignedTo: z.string().uuid(),
  scheduledDate: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = AssignJobSchema.parse(body);

    const result = await assignJob(id, input.assignedTo, input.scheduledDate);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[api/tasks/jobs/[id]/assign] POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to assign job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}



