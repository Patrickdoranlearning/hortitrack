export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { sendDocumentEmail } from "@/server/documents/email";
import { requireDocumentAccess } from "@/server/documents/access";

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    await requireDocumentAccess();
    const body = await req.json().catch(() => ({}));
    if (!body?.to) {
      return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
    }
    const result = await sendDocumentEmail({
      to: body.to,
      subject: body.subject,
      message: body.message,
      templateId: params.templateId,
      layoutOverride: body?.layout,
      documentType: body?.documentType,
      dataContext: body?.dataContext,
    });
    return NextResponse.json(result, { status: result.sent ? 200 : 202 });
  } catch (err: any) {
    console.error("[documents] send failed", err);
    const status = err?.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: err?.message ?? "Failed to send document" }, { status });
  }
}

