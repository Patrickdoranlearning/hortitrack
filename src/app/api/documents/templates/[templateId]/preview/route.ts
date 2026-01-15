export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { previewTemplate } from "@/server/documents";
import { requireDocumentAccess } from "@/server/documents/access";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    await requireDocumentAccess();
    const body = await req.json().catch(() => ({}));
    const { html, dataUsed, layout, documentType } = await previewTemplate({
      templateId,
      layoutOverride: body?.layout,
      documentType: body?.documentType,
      dataContext: body?.dataContext,
    });
    return NextResponse.json({ html, dataUsed, layout, documentType });
  } catch (err: any) {
    console.error("[documents] preview failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to preview template" }, { status });
  }
}

