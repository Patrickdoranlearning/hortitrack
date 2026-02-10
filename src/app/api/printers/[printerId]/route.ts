import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { logger } from "@/server/utils/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ printerId: string }> }
) {
  try {
    const { printerId } = await params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("printers")
      .select("*")
      .eq("id", printerId)
      .eq("org_id", orgId)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    logger.api.error("GET /api/printers/[id] failed", e);
    return NextResponse.json({ error: e?.message || "Failed to fetch printer" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ printerId: string }> }
) {
  try {
    const { printerId } = await params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      type,
      connection_type,
      host,
      port,
      is_default,
      is_active,
      dpi,
      notes,
      agent_id,
      usb_device_id,
      usb_device_name,
      label_columns,
      label_width_mm,
      label_gap_mm,
    } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (connection_type !== undefined) updateData.connection_type = connection_type;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (dpi !== undefined) updateData.dpi = dpi;
    if (notes !== undefined) updateData.notes = notes;
    if (label_columns !== undefined) updateData.label_columns = label_columns;
    if (label_width_mm !== undefined) updateData.label_width_mm = label_width_mm;
    if (label_gap_mm !== undefined) updateData.label_gap_mm = label_gap_mm;

    // Handle connection-type specific fields
    if (connection_type === "agent") {
      updateData.agent_id = agent_id;
      updateData.usb_device_id = usb_device_id ?? null;
      updateData.usb_device_name = usb_device_name ?? null;
      updateData.host = null;
      updateData.port = null;
    } else if (connection_type === "network") {
      updateData.host = host;
      updateData.port = port;
      updateData.agent_id = null;
      updateData.usb_device_id = null;
      updateData.usb_device_name = null;
    } else {
      // Partial update without changing connection type
      if (host !== undefined) updateData.host = host;
      if (port !== undefined) updateData.port = port;
      if (agent_id !== undefined) updateData.agent_id = agent_id;
      if (usb_device_id !== undefined) updateData.usb_device_id = usb_device_id;
      if (usb_device_name !== undefined) updateData.usb_device_name = usb_device_name;
    }

    const { data, error } = await supabase
      .from("printers")
      .update(updateData)
      .eq("id", printerId)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    logger.api.error("PUT /api/printers/[id] failed", e);
    return NextResponse.json({ error: e?.message || "Failed to update printer" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ printerId: string }> }
) {
  try {
    const { printerId } = await params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { error } = await supabase
      .from("printers")
      .delete()
      .eq("id", printerId)
      .eq("org_id", orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    logger.api.error("DELETE /api/printers/[id] failed", e);
    return NextResponse.json({ error: e?.message || "Failed to delete printer" }, { status: 500 });
  }
}







