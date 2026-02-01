import { NextResponse } from "next/server";
import { z } from "zod";
import { updateJobChecklistProgress } from "@/server/production/jobs";
import { logError } from "@/lib/log";
import type { ChecklistProgress } from "@/server/tasks/checklist-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChecklistItemProgressSchema = z.object({
  itemId: z.string(),
  checked: z.boolean(),
  skippedReason: z.string().optional(),
  timestamp: z.string().optional(),
});

const ChecklistProgressSchema = z.object({
  checklistProgress: z.object({
    prerequisites: z.array(ChecklistItemProgressSchema),
    postrequisites: z.array(ChecklistItemProgressSchema),
  }),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/tasks/jobs/[id]/checklist
 * Updates the checklist progress for a production job
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { checklistProgress } = ChecklistProgressSchema.parse(body);

    const job = await updateJobChecklistProgress(id, checklistProgress as ChecklistProgress);

    return NextResponse.json({ job });
  } catch (error: unknown) {
    logError("[api/tasks/jobs/[id]/checklist] PATCH error", { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to update checklist";
    const status = /unauthenticated/i.test(message) ? 401 :
                   /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
