import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getTaskById,
  updateTask,
  deleteTask,
} from "@/server/tasks/service";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  priority: z.number().int().optional(),
  status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  plantQuantity: z.number().int().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const task = await getTaskById(id);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: unknown) {
    logger.api.error("Task fetch failed", error);
    const message = error instanceof Error ? error.message : "Failed to fetch task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = UpdateTaskSchema.parse(body);

    const task = await updateTask(id, input);

    return NextResponse.json({ task });
  } catch (error: unknown) {
    logger.api.error("Task update failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteTask(id);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logger.api.error("Task deletion failed", error);
    const message = error instanceof Error ? error.message : "Failed to delete task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

