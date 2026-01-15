export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  TemplateInputSchema,
  deleteTemplate,
  getDocumentTemplate,
  saveTemplateDraft,
} from "@/server/documents";
import { requireDocumentAccess } from "@/server/documents/access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    await requireDocumentAccess();
    const template = await getDocumentTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (err: any) {
    console.error("[documents] get failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to load template" }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    await requireDocumentAccess();
    const body = await req.json().catch(() => ({}));
    const parsed = TemplateInputSchema.safeParse({ ...body, id: templateId });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 422 });
    }
    const template = await saveTemplateDraft(parsed.data as any);
    return NextResponse.json({ template });
  } catch (err: any) {
    console.error("[documents] update failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to update template" }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    await requireDocumentAccess();
    await deleteTemplate(templateId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[documents] delete failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to delete template" }, { status });
  }
}

