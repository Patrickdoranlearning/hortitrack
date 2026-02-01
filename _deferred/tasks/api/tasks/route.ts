import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getTasks,
  createTask,
  type TaskFilter,
  type SourceModule,
  type TaskStatus,
} from "@/server/tasks/service";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateTaskSchema = z.object({
  sourceModule: z.enum(["production", "dispatch", "plant_health"]),
  sourceRefType: z.string().optional(),
  sourceRefId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  taskType: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  assignedTeamId: z.string().uuid().optional(),
  scheduledDate: z.string().optional(),
  priority: z.number().int().optional(),
  plantQuantity: z.number().int().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const filter: TaskFilter = {};

    // Parse query params
    const status = url.searchParams.get("status");
    const assignedTo = url.searchParams.get("assignedTo");
    const scheduledDate = url.searchParams.get("scheduledDate");
    const scheduledDateFrom = url.searchParams.get("scheduledDateFrom");
    const scheduledDateTo = url.searchParams.get("scheduledDateTo");
    const sourceModule = url.searchParams.get("sourceModule");
    const taskType = url.searchParams.get("taskType");

    if (status) {
      const statuses = status.split(",") as TaskStatus[];
      filter.status = statuses.length === 1 ? statuses[0] : statuses;
    }
    if (assignedTo) filter.assignedTo = assignedTo;
    if (scheduledDate) filter.scheduledDate = scheduledDate;
    if (scheduledDateFrom) filter.scheduledDateFrom = scheduledDateFrom;
    if (scheduledDateTo) filter.scheduledDateTo = scheduledDateTo;
    if (sourceModule) filter.sourceModule = sourceModule as SourceModule;
    if (taskType) filter.taskType = taskType;

    const tasks = await getTasks(filter);

    return NextResponse.json({ tasks, totalCount: tasks.length });
  } catch (error: unknown) {
    logError("[api/tasks] GET error", { error });
    const message = error instanceof Error ? error.message : "Failed to fetch tasks";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Rate limit: 60 task creations per minute per user
    const rlKey = `tasks:create:${requestKey(req, user?.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests, please try again later", resetMs: rl.resetMs },
        { status: 429 }
      );
    }

    const body = await req.json();
    const input = CreateTaskSchema.parse(body);

    const task = await createTask(input);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: unknown) {
    logError("[api/tasks] POST error", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

