import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getJobById,
  getJobBatches,
  updateJob,
  deleteJob,
} from "@/server/production/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateJobSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  machine: z.string().optional(),
  location: z.string().optional(),
  processType: z.enum(["potting", "propagation", "transplant", "spacing", "other"]).optional(),
  scheduledWeek: z.number().int().min(1).max(53).optional(),
  scheduledYear: z.number().int().min(2024).max(2100).optional(),
  scheduledDate: z.string().optional(),
  wizardTemplate: z.string().optional(),
  status: z.enum(["draft", "unassigned", "assigned", "in_progress", "completed", "cancelled"]).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const includeBatches = url.searchParams.get("includeBatches") === "true";

    const job = await getJobById(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (includeBatches) {
      const batches = await getJobBatches(id);
      return NextResponse.json({ job, batches });
    }

    return NextResponse.json({ job });
  } catch (error: unknown) {
    console.error("[api/tasks/jobs/[id]] GET error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = UpdateJobSchema.parse(body);

    const job = await updateJob(id, input);

    return NextResponse.json({ job });
  } catch (error: unknown) {
    console.error("[api/tasks/jobs/[id]] PATCH error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteJob(id);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[api/tasks/jobs/[id]] DELETE error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


