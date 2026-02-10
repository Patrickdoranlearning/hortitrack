export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { generateTemplatePdf } from "@/server/documents";
import { logger } from "@/server/utils/logger";
import { requireDocumentAccess } from "@/server/documents/access";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    await requireDocumentAccess();
    const body = await req.json().catch(() => ({}));
    const { pdf, documentType } = await generateTemplatePdf({
      templateId,
      layoutOverride: body?.layout,
      documentType: body?.documentType,
      dataContext: body?.dataContext,
    });
    const filename = `${documentType ?? "document"}.pdf`;
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    logger.documents.error("Document PDF generation failed", err);
    const message = err instanceof Error ? err.message : "Failed to generate PDF";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

