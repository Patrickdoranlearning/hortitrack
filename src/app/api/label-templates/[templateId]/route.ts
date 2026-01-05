import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

export async function GET(
  _req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("label_templates")
      .select("*")
      .eq("id", params.templateId)
      .eq("org_id", orgId)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/label-templates/[id]] GET error:", e);
    return NextResponse.json({ error: e?.message || "Failed to fetch template" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      name, 
      description, 
      label_type,
      width_mm, 
      height_mm, 
      margin_mm, 
      dpi, 
      zpl_template, 
      layout, 
      is_default,
      is_active 
    } = body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (label_type !== undefined) updateData.label_type = label_type;
    if (width_mm !== undefined) updateData.width_mm = width_mm;
    if (height_mm !== undefined) updateData.height_mm = height_mm;
    if (margin_mm !== undefined) updateData.margin_mm = margin_mm;
    if (dpi !== undefined) updateData.dpi = dpi;
    if (zpl_template !== undefined) updateData.zpl_template = zpl_template;
    if (layout !== undefined) updateData.layout = layout;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from("label_templates")
      .update(updateData)
      .eq("id", params.templateId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/label-templates/[id]] PUT error:", e);
    return NextResponse.json({ error: e?.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { error } = await supabase
      .from("label_templates")
      .delete()
      .eq("id", params.templateId)
      .eq("org_id", orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[api/label-templates/[id]] DELETE error:", e);
    return NextResponse.json({ error: e?.message || "Failed to delete template" }, { status: 500 });
  }
}





