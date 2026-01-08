import "server-only";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import type {
  DocumentTemplate,
  DocumentTemplateVersion,
  DocumentType,
  TemplateLayout,
} from "@/lib/documents/types";
import { defaultLayoutFor, getDocumentData } from "./data";
import { renderDocumentHtml, renderDocumentPdf } from "./render";

const LayoutSchema: z.ZodType<TemplateLayout> = z.lazy(() =>
  z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "heading",
        "text",
        "table",
        "list",
        "box",
        "image",
        "divider",
        "spacer",
        "chips",
      ]),
      text: z.string().optional(),
      label: z.string().optional(),
      binding: z.string().optional(),
      level: z.number().optional(),
      size: z.number().optional(),
      url: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      rowsBinding: z.string().optional(),
      showHeader: z.boolean().optional(),
      columns: z
        .array(
          z.object({
            key: z.string(),
            label: z.string(),
            binding: z.string().optional(),
            width: z.number().optional(),
            align: z.enum(["left", "center", "right"]).optional(),
            format: z.enum(["text", "currency", "number", "date"]).optional(),
          })
        )
        .optional(),
      items: z
        .array(
          z.object({
            label: z.string().optional(),
            binding: z.string().optional(),
            color: z.string().optional(),
          })
        )
        .optional(),
      children: LayoutSchema.optional(),
      style: z.record(z.any()).optional(),
      visibleWhen: z.any().optional(),
    })
  )
);

const DocumentTypeEnum = z.enum([
  "invoice",
  "delivery_docket",
  "order_confirmation",
  "av_list",
  "lookin_good",
]);

export const TemplateInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  documentType: DocumentTypeEnum,
  layout: LayoutSchema.optional(),
  variables: z.record(z.any()).optional(),
  sampleData: z.record(z.any()).optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

function mapVersion(row: any): DocumentTemplateVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: row.version_number,
    layout: (row.layout as TemplateLayout) ?? [],
    variables: row.variables ?? {},
    sampleData: row.sample_data ?? {},
    bindings: row.bindings ?? {},
    notes: row.notes ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function mapTemplate(row: any): DocumentTemplate {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    documentType: row.document_type,
    status: row.status,
    currentVersionId: row.current_version_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersion: row.current_version ? mapVersion(row.current_version) : null,
    versions: row.versions ? row.versions.map(mapVersion) : undefined,
  };
}

export async function listDocumentTemplates(): Promise<DocumentTemplate[]> {
  const { supabase, orgId } = await getUserAndOrg();
  const { data, error } = await supabase
    .from("document_templates")
    .select("*, current_version:document_template_versions!document_templates_current_version_fk(*)")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTemplate);
}

export async function getDocumentTemplate(templateId: string): Promise<DocumentTemplate | null> {
  const { supabase, orgId } = await getUserAndOrg();
  const { data, error } = await supabase
    .from("document_templates")
    .select(
      "*, current_version:document_template_versions!document_templates_current_version_fk(*), versions:document_template_versions!document_template_versions_template_id_fkey(*)"
    )
    .eq("id", templateId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTemplate(data) : null;
}

export async function saveTemplateDraft(input: z.infer<typeof TemplateInputSchema>): Promise<DocumentTemplate> {
  const parsed = TemplateInputSchema.parse(input);
  const { supabase, orgId, user } = await getUserAndOrg();
  const baseLayout = parsed.layout ?? defaultLayoutFor(parsed.documentType);

  if (!parsed.id) {
    const { data: templateRow, error: tErr } = await supabase
      .from("document_templates")
      .insert({
        org_id: orgId,
        name: parsed.name,
        description: parsed.description ?? null,
        document_type: parsed.documentType,
        status: parsed.status ?? "draft",
      })
      .select()
      .maybeSingle();
    if (tErr || !templateRow) throw new Error(tErr?.message ?? "Failed to create template");

    const { data: versionRow, error: vErr } = await supabase
      .from("document_template_versions")
      .insert({
        template_id: templateRow.id,
        version_number: 1,
        layout: baseLayout,
        variables: parsed.variables ?? {},
        sample_data: parsed.sampleData ?? {},
        notes: parsed.notes ?? null,
        created_by: user?.id,
      })
      .select()
      .maybeSingle();
    if (vErr || !versionRow) throw new Error(vErr?.message ?? "Failed to create version");

    const { data: updatedTemplate, error: uErr } = await supabase
      .from("document_templates")
      .update({ current_version_id: versionRow.id })
      .eq("id", templateRow.id)
      .select(
        "*, current_version:document_template_versions!document_templates_current_version_fk(*), versions:document_template_versions!document_template_versions_template_id_fkey(*)"
      )
      .maybeSingle();
    if (uErr || !updatedTemplate) throw new Error(uErr?.message ?? "Failed to link version");
    return mapTemplate(updatedTemplate);
  }

  // Updating existing template -> create new version
  const { data: latestVersion, error: latestErr } = await supabase
    .from("document_template_versions")
    .select("version_number")
    .eq("template_id", parsed.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw new Error(latestErr.message);
  const nextVersion = (latestVersion?.version_number ?? 0) + 1;

  const { error: vInsErr, data: version } = await supabase
    .from("document_template_versions")
    .insert({
      template_id: parsed.id,
      version_number: nextVersion,
      layout: baseLayout,
      variables: parsed.variables ?? {},
      sample_data: parsed.sampleData ?? {},
      notes: parsed.notes ?? null,
      created_by: user?.id,
    })
    .select()
    .maybeSingle();
  if (vInsErr || !version) throw new Error(vInsErr?.message ?? "Failed to version template");

  const { data: updated, error: updErr } = await supabase
    .from("document_templates")
    .update({
      name: parsed.name,
      description: parsed.description ?? null,
      document_type: parsed.documentType,
      status: parsed.status ?? "draft",
      current_version_id: version.id,
    })
    .eq("id", parsed.id)
    .eq("org_id", orgId)
    .select(
      "*, current_version:document_template_versions!document_templates_current_version_fk(*), versions:document_template_versions!document_template_versions_template_id_fkey(*)"
    )
    .maybeSingle();
  if (updErr || !updated) throw new Error(updErr?.message ?? "Failed to update template");
  return mapTemplate(updated);
}

export async function publishTemplate(templateId: string, versionId?: string): Promise<DocumentTemplate> {
  const { supabase, orgId } = await getUserAndOrg();
  let targetVersion = versionId;
  if (!targetVersion) {
    const { data: latest, error } = await supabase
      .from("document_template_versions")
      .select("id")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    targetVersion = latest?.id ?? null;
  }

  const { data, error } = await supabase
    .from("document_templates")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      current_version_id: targetVersion,
    })
    .eq("id", templateId)
    .eq("org_id", orgId)
    .select(
      "*, current_version:document_template_versions!document_templates_current_version_fk(*), versions:document_template_versions!document_template_versions_template_id_fkey(*)"
    )
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Failed to publish");
  return mapTemplate(data);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();
  const { error } = await supabase
    .from("document_templates")
    .delete()
    .eq("id", templateId)
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
}

export async function previewTemplate(params: {
  templateId?: string;
  layoutOverride?: TemplateLayout;
  documentType?: DocumentType;
  dataContext?: Record<string, unknown>;
}) {
  const template = params.templateId ? await getDocumentTemplate(params.templateId) : null;
  const layout =
    params.layoutOverride ??
    template?.currentVersion?.layout ??
    defaultLayoutFor(params.documentType ?? template?.documentType ?? "invoice");
  const documentType = params.documentType ?? template?.documentType ?? "invoice";
  const data = await getDocumentData(documentType, {
    payload: params.dataContext ?? template?.currentVersion?.sampleData ?? {},
  });
  const html = renderDocumentHtml(layout, data, { documentType });
  return { html, dataUsed: data, layout, documentType };
}

export async function generateTemplatePdf(params: {
  templateId?: string;
  layoutOverride?: TemplateLayout;
  documentType?: DocumentType;
  dataContext?: Record<string, unknown>;
}) {
  const template = params.templateId ? await getDocumentTemplate(params.templateId) : null;
  const layout =
    params.layoutOverride ??
    template?.currentVersion?.layout ??
    defaultLayoutFor(params.documentType ?? template?.documentType ?? "invoice");
  const documentType = params.documentType ?? template?.documentType ?? "invoice";
  const data = await getDocumentData(documentType, {
    payload: params.dataContext ?? template?.currentVersion?.sampleData ?? {},
  });
  const pdf = await renderDocumentPdf(layout, data, { documentType });
  return { pdf, dataUsed: data, documentType };
}

