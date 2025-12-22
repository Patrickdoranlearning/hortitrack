import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const labelType = searchParams.get("type");

    let query = supabase
      .from("label_templates")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (labelType) {
      query = query.eq("label_type", labelType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/label-templates] GET error:", e);
    return NextResponse.json({ error: e?.message || "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
      is_default 
    } = body;

    if (!name || !width_mm || !height_mm) {
      return NextResponse.json({ 
        error: "Name, width_mm, and height_mm are required" 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("label_templates")
      .insert({
        org_id: orgId,
        name,
        description,
        label_type: label_type || "batch",
        width_mm,
        height_mm,
        margin_mm: margin_mm ?? 3,
        dpi: dpi || 203,
        zpl_template,
        layout: layout || {},
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/label-templates] POST error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create template" }, { status: 500 });
  }
}




