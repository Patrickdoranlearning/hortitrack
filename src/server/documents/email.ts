import "server-only";
import type { DocumentType, TemplateLayout } from "@/lib/documents/types";
import { generateTemplatePdf, previewTemplate } from "./templates";

type SendParams = {
  to: string;
  subject?: string;
  message?: string;
  templateId?: string;
  layoutOverride?: TemplateLayout;
  documentType?: DocumentType;
  dataContext?: Record<string, unknown>;
};

export async function sendDocumentEmail(params: SendParams) {
  const webhook =
    process.env.DOCUMENTS_EMAIL_WEBHOOK_URL ||
    process.env.EMAIL_WEBHOOK_URL ||
    null;
  const from = process.env.DOCUMENTS_EMAIL_FROM || "no-reply@hortitrack.local";

  const { html, dataUsed } = await previewTemplate({
    templateId: params.templateId,
    layoutOverride: params.layoutOverride,
    documentType: params.documentType,
    dataContext: params.dataContext,
  });
  const { pdf } = await generateTemplatePdf({
    templateId: params.templateId,
    layoutOverride: params.layoutOverride,
    documentType: params.documentType,
    dataContext: params.dataContext,
  });

  if (!webhook) {
    return {
      sent: false,
      error: "EMAIL_WEBHOOK not configured",
      preview: { html, dataUsed },
    };
  }

  const payload = {
    to: params.to,
    from,
    subject: params.subject ?? "Document from HortiTrack",
    html,
    text: params.message ?? "",
    attachments: [
      {
        filename: `${params.documentType ?? "document"}.pdf`,
        content: Buffer.from(pdf).toString("base64"),
        type: "application/pdf",
      },
    ],
  };

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return {
      sent: false,
      status: res.status,
      error: errText,
      preview: { html, dataUsed },
    };
  }

  return { sent: true, status: res.status, preview: { html, dataUsed } };
}







