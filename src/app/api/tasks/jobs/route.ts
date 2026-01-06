import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getProductionJobs,
  createJob,
  getAvailableGhostBatches,
  type JobFilter,
  type JobStatus,
  type ProcessType,
} from "@/server/production/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateJobSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  machine: z.string().optional(),
  location: z.string().optional(),
  processType: z.enum(["potting", "propagation", "transplant", "spacing", "other"]).optional(),
  scheduledWeek: z.number().int().min(1).max(53).optional(),
  scheduledYear: z.number().int().min(2024).max(2100).optional(),
  scheduledDate: z.string().optional(),
  wizardTemplate: z.string().optional(),
  batchIds: z.array(z.string().uuid()).min(1, "At least one batch is required"),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Check if requesting available ghost batches
    const getBatches = url.searchParams.get("availableBatches");
    if (getBatches === "true") {
      const batches = await getAvailableGhostBatches();
      return NextResponse.json({ batches, totalCount: batches.length });
    }

    const filter: JobFilter = {};

    // Parse query params
    const status = url.searchParams.get("status");
    const assignedTo = url.searchParams.get("assignedTo");
    const scheduledWeek = url.searchParams.get("scheduledWeek");
    const scheduledYear = url.searchParams.get("scheduledYear");
    const processType = url.searchParams.get("processType");

    if (status) {
      const statuses = status.split(",") as JobStatus[];
      filter.status = statuses.length === 1 ? statuses[0] : statuses;
    }
    if (assignedTo) filter.assignedTo = assignedTo;
    if (scheduledWeek) filter.scheduledWeek = parseInt(scheduledWeek, 10);
    if (scheduledYear) filter.scheduledYear = parseInt(scheduledYear, 10);
    if (processType) filter.processType = processType as ProcessType;

    const jobs = await getProductionJobs(filter);

    return NextResponse.json({ jobs, totalCount: jobs.length });
  } catch (error: unknown) {
    console.error("[api/tasks/jobs] GET error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch jobs";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateJobSchema.parse(body);

    const job = await createJob(input);

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: unknown) {
    console.error("[api/tasks/jobs] POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create job";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}





