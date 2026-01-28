import { NextRequest, NextResponse } from "next/server";
import {
  getChecklistTemplates,
  createChecklistTemplate,
  type SourceModule,
  type ChecklistType,
} from "@/server/tasks/checklist-service";
import { getUserAndOrg } from "@/server/auth/org";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { logError } from "@/lib/log";

export async function GET(request: NextRequest) {
  try {
    // Validate auth
    await getUserAndOrg();

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
    logError("GET /api/settings/checklists failed", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getUserAndOrg();

    // Rate limit: 10 templates per minute per user
    const rlKey = `checklists:create:${requestKey(request, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 10 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", resetMs: rl.resetMs }, { status: 429 });
    }

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
    logError("POST /api/settings/checklists failed", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
