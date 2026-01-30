export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { agentConnectionManager } from "@/server/labels/agent-connection-manager";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

/**
 * WebSocket endpoint for print agent connections.
 *
 * Next.js 14+ supports WebSocket via the upgrade mechanism.
 * The agent connects with: wss://your-domain.com/api/print-agents/ws
 *
 * Protocol:
 * 1. Agent sends: { type: "auth", agentKey: "pa_xxx...", workstationInfo: {...} }
 * 2. Server validates key, marks agent online, responds: { type: "auth_success", agentId, agentName }
 * 3. Agent sends heartbeats every 30s: { type: "heartbeat", connectedPrinters: [...] }
 * 4. Server pushes print jobs: { type: "print_job", jobId, printerId, zpl, copies }
 * 5. Agent responds: { type: "job_result", jobId, status: "completed"|"failed", error? }
 * 6. Agent shuts down: { type: "offline" }
 */

// This is a GET handler that will be upgraded to WebSocket
export async function GET(req: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers.get("upgrade");

  if (upgradeHeader !== "websocket") {
    return NextResponse.json(
      { error: "Expected WebSocket upgrade request" },
      { status: 426 }
    );
  }

  // Rate limit upgrade requests: 10 per minute per IP
  const rlKey = `print-agent:ws-upgrade:${requestKey(req)}`;
  const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // For Vercel/Edge runtime, we need to handle WebSocket differently
  // This implementation works with Node.js runtime

  try {
    // @ts-expect-error - WebSocket upgrade is not typed in Next.js
    const { socket, response } = await new Promise((resolve, reject) => {
      // Access the underlying socket for upgrade
      // This requires custom server setup or specific hosting support
      reject(new Error("WebSocket requires custom server configuration"));
    });

    return response;
  } catch {
    // Fallback: Return instructions for setting up WebSocket
    return NextResponse.json({
      error: "WebSocket endpoint",
      message: "This endpoint requires WebSocket connection. Use ws:// or wss:// protocol.",
      docs: "https://docs.hortitrack.com/print-agent/setup",
    }, { status: 400 });
  }
}

/**
 * POST endpoint for agents that can't use WebSocket (polling fallback).
 *
 * Actions:
 * - auth: Authenticate and mark agent online
 * - heartbeat: Update status and get pending jobs
 * - job_result: Report job completion
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit polling/auth requests: 60 per minute per IP
    const rlKey = `print-agent:poll:${requestKey(req)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 60 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { action, agentKey, ...data } = body;

    if (!agentKey) {
      return NextResponse.json({ error: "agentKey is required" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Hash the provided key to compare with stored hash
    const keyHash = createHash("sha256").update(agentKey).digest("hex");

    // Find agent by key hash
    const { data: agent, error: agentError } = await supabase
      .from("print_agents")
      .select("id, org_id, name, status")
      .eq("agent_key", keyHash)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Invalid agent key" }, { status: 401 });
    }

    switch (action) {
      case "auth": {
        // Update agent status and workstation info
        const { workstationInfo } = data;

        await supabase
          .from("print_agents")
          .update({
            status: "online",
            last_seen_at: new Date().toISOString(),
            workstation_info: workstationInfo || {},
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        return NextResponse.json({
          type: "auth_success",
          agentId: agent.id,
          agentName: agent.name,
        });
      }

      case "heartbeat": {
        const { connectedPrinters } = data;

        // Update last seen
        await supabase
          .from("print_agents")
          .update({
            status: "online",
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        // Get pending jobs for this agent
        const { data: pendingJobs } = await supabase
          .from("print_queue")
          .select(`
            id,
            printer_id,
            job_type,
            zpl_data,
            copies,
            printers:printer_id (usb_device_id, usb_device_name)
          `)
          .eq("agent_id", agent.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(10);

        // Mark jobs as sent
        if (pendingJobs && pendingJobs.length > 0) {
          const jobIds = pendingJobs.map((j) => j.id);
          await supabase
            .from("print_queue")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .in("id", jobIds);
        }

        // Format jobs for agent
        const jobs = (pendingJobs || []).map((job) => ({
          jobId: job.id,
          printerId: job.printer_id,
          usbDeviceId: (job.printers as { usb_device_id?: string })?.usb_device_id,
          usbDeviceName: (job.printers as { usb_device_name?: string })?.usb_device_name,
          zpl: job.zpl_data,
          copies: job.copies,
        }));

        return NextResponse.json({
          type: "heartbeat_ack",
          jobs,
          connectedPrintersReceived: connectedPrinters?.length || 0,
        });
      }

      case "job_result": {
        const { jobId, status, error: jobError } = data;

        if (!jobId || !status) {
          return NextResponse.json(
            { error: "jobId and status are required" },
            { status: 400 }
          );
        }

        // Update job status
        await supabase
          .from("print_queue")
          .update({
            status: status === "completed" ? "completed" : "failed",
            error_message: jobError || null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId)
          .eq("agent_id", agent.id);

        return NextResponse.json({
          type: "job_result_ack",
          jobId,
          status,
        });
      }

      case "offline": {
        // Agent is shutting down gracefully
        await supabase
          .from("print_agents")
          .update({
            status: "offline",
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        return NextResponse.json({ type: "offline_ack" });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Request failed";
    console.error("[api/print-agents/ws] POST error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
