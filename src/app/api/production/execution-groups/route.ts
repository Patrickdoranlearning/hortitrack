import { NextResponse } from "next/server";
import {
  getExecutionGroups,
  createGroup,
  type CreateGroupInput,
} from "@/server/production/execution-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/production/execution-groups
 * List all execution groups for the current organization
 */
export async function GET() {
  try {
    const groups = await getExecutionGroups();
    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load execution groups";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/production/execution-groups
 * Create a new execution group
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input: CreateGroupInput = {
      name: body.name,
      description: body.description,
      filterCriteria: body.filterCriteria,
      sortOrder: body.sortOrder,
      color: body.color,
      icon: body.icon,
    };

    const group = await createGroup(input);
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create execution group";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
