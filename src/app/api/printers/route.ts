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
    const { name, type, connection_type, host, port, is_default, dpi, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "Printer name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("printers")
      .insert({
        org_id: orgId,
        name,
        type: type || "zebra",
        connection_type: connection_type || "network",
        host,
        port: port || 9100,
        is_default: is_default || false,
        dpi: dpi || 203,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error("[api/printers] POST error:", e);
    return NextResponse.json({ error: e?.message || "Failed to create printer" }, { status: 500 });
  }
}

