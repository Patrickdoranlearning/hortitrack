import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistTemplateById,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "@/server/tasks/checklist-service";

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
    console.error("[API] GET /api/settings/checklists/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch template" },
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
    console.error("[API] PATCH /api/settings/checklists/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
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
    console.error("[API] DELETE /api/settings/checklists/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete template" },
      { status: 500 }
    );
  }
}

