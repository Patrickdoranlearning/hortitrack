import { NextResponse } from "next/server";
import { z } from "zod";
import { completeTask } from "@/server/tasks/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CompleteTaskSchema = z.object({
  actualPlantQuantity: z.number().int().positive().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = CompleteTaskSchema.parse(body);

    const task = await completeTask(id, input.actualPlantQuantity);

    return NextResponse.json({ task });
  } catch (error: unknown) {
    console.error("[api/tasks/[id]/complete] POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to complete task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}



