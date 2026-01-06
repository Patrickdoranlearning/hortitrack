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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("print_jobs")
      .select(`
        *,
        template:label_templates(id, name),
        printer:printers(id, name)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (labelType) {
      query = query.eq("label_type", labelType);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (e: any) {
    console.error("[api/print-jobs] GET error:", e);
    return NextResponse.json({ error: e?.message || "Failed to fetch print jobs" }, { status: 500 });
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
      label_type,
      template_id,
      printer_id,
      copies,
      status,
      error_message,
      payload_json,
    } = body;

    if (!label_type) {
      return NextResponse.json({ error: "label_type is required" }, { status: 400 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("print_jobs")
      .insert({
        org_id: orgId,
        label_type,
        template_id,
        printer_id,
        copies: copies ?? 1,
        status: status ?? "completed",
        error_message,
        payload_json: payload_json ?? {},
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/print-jobs] POST error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create print job" }, { status: 500 });
  }
}







