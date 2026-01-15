export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp, getSupabaseAdmin } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { sendRawToPrinter } from "@/server/labels/send-to-printer";

type RouteContext = {
  params: Promise<{ printerId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { printerId } = await context.params;
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    // Fetch printer config
    const { data: printer, error } = await supabase
      .from("printers")
      .select("*")
      .eq("id", printerId)
      .eq("org_id", orgId)
      .single();

    if (error || !printer) {
      return NextResponse.json({ error: "Printer not found" }, { status: 404 });
    }

    // Build test label ZPL
    const testZpl = [
      "^XA",
      "^CF0,40",
      "^FO50,50^FDPrinter Test^FS",
      "^CF0,30",
      `^FO50,100^FD${printer.name}^FS`,
      `^FO50,140^FD${new Date().toLocaleString()}^FS`,
      "^FO50,190^FDIf you see this, the printer is working!^FS",
      "^XZ",
    ].join("\n");

    const connectionType = printer.connection_type || "network";

    if (connectionType === "network") {
      if (!printer.host) {
        return NextResponse.json({
          error: "Printer host is not configured",
          success: false
        }, { status: 400 });
      }
      await sendRawToPrinter(printer.host, printer.port || 9100, testZpl);
    } else if (connectionType === "agent") {
      if (!printer.agent_id) {
        return NextResponse.json({
          error: "Printer is not associated with an agent",
          success: false
        }, { status: 400 });
      }

      // Check if agent is online by checking database status and last_seen_at
      const supabaseAdmin = getSupabaseAdmin();
      const { data: agent } = await supabaseAdmin
        .from("print_agents")
        .select("id, status, last_seen_at")
        .eq("id", printer.agent_id)
        .single();

      if (!agent) {
        return NextResponse.json({
          error: "Print agent not found",
          success: false
        }, { status: 400 });
      }

      // Check if agent is online (status is online and last seen within 2 minutes)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at) : null;
      const isOnline = agent.status === "online" && lastSeen && lastSeen > twoMinutesAgo;

      if (!isOnline) {
        return NextResponse.json({
          error: "Print agent is offline. Please ensure the agent is running.",
          success: false
        }, { status: 400 });
      }

      // Queue the test print job for the agent to pick up via polling
      const { error: queueError } = await supabaseAdmin
        .from("print_queue")
        .insert({
          org_id: orgId,
          printer_id: printer.id,
          agent_id: printer.agent_id,
          job_type: "test",
          zpl_data: testZpl,
          copies: 1,
          status: "pending",
        });

      if (queueError) {
        console.error("[api/printers/[id]/test] Queue error:", queueError);
        return NextResponse.json({
          error: "Failed to queue test print",
          success: false
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({
        error: `Unknown connection type: ${connectionType}`,
        success: false
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Test label sent successfully"
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to test printer";
    console.error("[api/printers/[id]/test] error:", e);
    return NextResponse.json({
      error: message,
      success: false
    }, { status: 500 });
  }
}
