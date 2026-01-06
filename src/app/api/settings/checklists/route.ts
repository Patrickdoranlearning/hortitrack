import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistTemplates,
  createChecklistTemplate,
  type SourceModule,
  type ChecklistType,
} from "@/server/tasks/checklist-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceModule = searchParams.get("sourceModule") as SourceModule | null;
    const processType = searchParams.get("processType");
    const checklistType = searchParams.get("checklistType") as ChecklistType | null;
    const isActive = searchParams.get("isActive");

    const templates = await getChecklistTemplates({
      sourceModule: sourceModule ?? undefined,
      processType: processType ?? undefined,
      checklistType: checklistType ?? undefined,
      isActive: isActive === null ? undefined : isActive === "true",
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[API] GET /api/settings/checklists error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { name, description, processType, checklistType, sourceModule, items } = body;

    if (!name || !processType || !checklistType || !sourceModule) {
      return NextResponse.json(
        { error: "Missing required fields: name, processType, checklistType, sourceModule" },
        { status: 400 }
      );
    }

    const template = await createChecklistTemplate({
      name,
      description,
      processType,
      checklistType,
      sourceModule,
      items: items ?? [],
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/settings/checklists error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 500 }
    );
  }
}

