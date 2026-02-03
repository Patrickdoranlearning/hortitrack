import { NextResponse } from "next/server";
import {
  getExecutionWorksheets,
  getOpenWorksheets,
  createExecutionWorksheet,
  type CreateWorksheetInput,
  type WorksheetStatus,
} from "@/server/production/execution-worksheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/production/execution-worksheets
 * List execution worksheets for the current organization.
 *
 * Query params:
 * - status: "open" | "completed" (optional, defaults to all)
 * - openOnly: "true" (shorthand for status=open)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") as WorksheetStatus | null;
    const openOnly = searchParams.get("openOnly") === "true";

    let worksheets;
    if (openOnly) {
      worksheets = await getOpenWorksheets();
    } else if (statusParam) {
      worksheets = await getExecutionWorksheets({ status: statusParam });
    } else {
      worksheets = await getExecutionWorksheets();
    }

    return NextResponse.json({ worksheets });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load execution worksheets";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/production/execution-worksheets
 * Create a new execution worksheet.
 *
 * Body:
 * - name: string (required)
 * - description: string (optional)
 * - scheduledDate: string ISO date (optional)
 * - batchIds: string[] (required, array of batch UUIDs)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!body.batchIds || !Array.isArray(body.batchIds)) {
      return NextResponse.json(
        { error: "batchIds must be an array" },
        { status: 400 }
      );
    }

    if (body.batchIds.length === 0) {
      return NextResponse.json(
        { error: "At least one batch ID is required" },
        { status: 400 }
      );
    }

    const input: CreateWorksheetInput = {
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      scheduledDate: body.scheduledDate || undefined,
      batchIds: body.batchIds,
    };

    const worksheet = await createExecutionWorksheet(input);
    return NextResponse.json({ worksheet }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create execution worksheet";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
