import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistTemplateById,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "@/server/tasks/checklist-service";
import { logger } from "@/server/utils/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const template = await getChecklistTemplateById(id);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    logger.api.error("GET /api/settings/checklists/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const template = await updateChecklistTemplate(id, body);

    return NextResponse.json({ template });
  } catch (error) {
    logger.api.error("PATCH /api/settings/checklists/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await deleteChecklistTemplate(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.api.error("DELETE /api/settings/checklists/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}

