import { NextResponse } from "next/server";
import {
  getExecutionWorksheetById,
  deleteExecutionWorksheet,
  completeWorksheet,
  reopenWorksheet,
} from "@/server/production/execution-worksheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/production/execution-worksheets/[id]
 * Get a single execution worksheet by ID with all batch details.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const worksheet = await getExecutionWorksheetById(id);

    if (!worksheet) {
      return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
    }

    return NextResponse.json({ worksheet });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load execution worksheet";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/production/execution-worksheets/[id]
 * Update worksheet status.
 *
 * Body:
 * - action: "complete" | "reopen"
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.action || !["complete", "reopen"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'complete' or 'reopen'" },
        { status: 400 }
      );
    }

    let worksheet;
    if (body.action === "complete") {
      worksheet = await completeWorksheet(id);
    } else {
      worksheet = await reopenWorksheet(id);
    }

    return NextResponse.json({ worksheet });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update execution worksheet";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/production/execution-worksheets/[id]
 * Delete an execution worksheet.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteExecutionWorksheet(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete execution worksheet";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
