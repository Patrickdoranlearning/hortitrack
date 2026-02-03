import { NextResponse } from "next/server";
import {
  getExecutionGroupById,
  updateGroup,
  deleteGroup,
  type UpdateGroupInput,
} from "@/server/production/execution-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/production/execution-groups/[id]
 * Get a single execution group by ID
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const group = await getExecutionGroupById(id);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load execution group";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PATCH /api/production/execution-groups/[id]
 * Update an execution group
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const input: UpdateGroupInput = {};
    if (body.name !== undefined) input.name = body.name;
    if (body.description !== undefined) input.description = body.description;
    if (body.filterCriteria !== undefined) input.filterCriteria = body.filterCriteria;
    if (body.sortOrder !== undefined) input.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) input.isActive = body.isActive;
    if (body.color !== undefined) input.color = body.color;
    if (body.icon !== undefined) input.icon = body.icon;

    const group = await updateGroup(id, input);
    return NextResponse.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update execution group";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/production/execution-groups/[id]
 * Delete an execution group
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteGroup(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete execution group";
    const status = /unauth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
