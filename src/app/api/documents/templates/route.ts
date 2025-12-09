export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { TemplateInputSchema, listDocumentTemplates, saveTemplateDraft } from "@/server/documents";
import { requireDocumentAccess } from "@/server/documents/access";

export async function GET() {
  try {
    await requireDocumentAccess();
    const templates = await listDocumentTemplates();
    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("[documents] list failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to list templates" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireDocumentAccess();
    const body = await req.json().catch(() => ({}));
    const parsed = TemplateInputSchema.omit({ id: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 422 });
    }
    const template = await saveTemplateDraft(parsed.data as any);
    return NextResponse.json({ template });
  } catch (err: any) {
    console.error("[documents] create failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to create template" }, { status });
  }
}

