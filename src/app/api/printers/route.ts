import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

export async function GET() {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("printers")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/printers] GET error:", e);
    return NextResponse.json({ error: e?.message || "Failed to fetch printers" }, { status: 500 });
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
      type,
      connection_type,
      host,
      port,
      is_default,
      dpi,
      notes,
      agent_id,
      usb_device_id,
      usb_device_name,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Printer name is required" }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      org_id: orgId,
      name,
      type: type || "zebra",
      connection_type: connection_type || "network",
      is_default: is_default || false,
      dpi: dpi || 203,
      notes,
    };

    // Set connection-specific fields
    if (connection_type === "agent") {
      insertData.agent_id = agent_id;
      insertData.usb_device_id = usb_device_id || null;
      insertData.usb_device_name = usb_device_name || null;
      insertData.host = null;
      insertData.port = null;
    } else {
      insertData.host = host;
      insertData.port = port || 9100;
      insertData.agent_id = null;
      insertData.usb_device_id = null;
      insertData.usb_device_name = null;
    }

    const { data, error } = await supabase
      .from("printers")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create printer";
    console.error("[api/printers] POST error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}







