import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

export async function GET(
  _req: NextRequest,
  { params }: { params: { printerId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("printers")
      .select("*")
      .eq("id", params.printerId)
      .eq("org_id", orgId)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/printers/[id]] GET error:", e);
    return NextResponse.json({ error: e?.message || "Failed to fetch printer" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { printerId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const body = await req.json();
    const { name, type, connection_type, host, port, is_default, is_active, dpi, notes } = body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (connection_type !== undefined) updateData.connection_type = connection_type;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (dpi !== undefined) updateData.dpi = dpi;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from("printers")
      .update(updateData)
      .eq("id", params.printerId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/printers/[id]] PUT error:", e);
    return NextResponse.json({ error: e?.message || "Failed to update printer" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { printerId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { error } = await supabase
      .from("printers")
      .delete()
      .eq("id", params.printerId)
      .eq("org_id", orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[api/printers/[id]] DELETE error:", e);
    return NextResponse.json({ error: e?.message || "Failed to delete printer" }, { status: 500 });
  }
}

