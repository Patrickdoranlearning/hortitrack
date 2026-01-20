import net from "net";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { agentConnectionManager } from "./agent-connection-manager";

export interface PrinterConfig {
  id: string;
  connection_type: string;
  host?: string | null;
  port?: number | null;
  agent_id?: string | null;
  usb_device_id?: string | null;
}

export interface SendToPrinterOptions {
  jobType: "batch" | "sale" | "location" | "trolley" | "passport";
  orgId: string;
  userId?: string;
  copies?: number;
}

export interface SendToPrinterResult {
  success: boolean;
  error?: string;
  jobId?: string;
}

/**
 * Send ZPL data to a printer, handling both network and agent-connected printers.
 */
export async function sendToPrinter(
  printer: PrinterConfig,
  zpl: string,
  options: SendToPrinterOptions
): Promise<SendToPrinterResult> {
  const connectionType = printer.connection_type || "network";

  if (connectionType === "network") {
    return sendViaNetwork(printer, zpl);
  } else if (connectionType === "agent") {
    return sendViaAgent(printer, zpl, options);
  }

  return {
    success: false,
    error: `Unknown connection type: ${connectionType}`,
  };
}

/**
 * Send ZPL directly to a network printer via TCP/IP socket.
 */
async function sendViaNetwork(
  printer: PrinterConfig,
  zpl: string
): Promise<SendToPrinterResult> {
  if (!printer.host) {
    return {
      success: false,
      error: "Printer host is not configured",
    };
  }

  const port = printer.port || 9100;

  try {
    await sendRawToPrinter(printer.host, port, zpl);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network print failed";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Queue a print job for an agent-connected printer.
 */
async function sendViaAgent(
  printer: PrinterConfig,
  zpl: string,
  options: SendToPrinterOptions
): Promise<SendToPrinterResult> {
  if (!printer.agent_id) {
    return {
      success: false,
      error: "Printer is not associated with a print agent",
    };
  }

  const supabase = getSupabaseAdmin();

  // Check if agent is online
  const { data: agent, error: agentError } = await supabase
    .from("print_agents")
    .select("id, status")
    .eq("id", printer.agent_id)
    .single();

  if (agentError || !agent) {
    return {
      success: false,
      error: "Print agent not found",
    };
  }

  if (agent.status !== "online") {
    return {
      success: false,
      error: "Print agent is offline. Please ensure the agent is running on the workstation.",
    };
  }

  // Create print queue entry
  const { data: job, error: insertError } = await supabase
    .from("print_queue")
    .insert({
      org_id: options.orgId,
      printer_id: printer.id,
      agent_id: printer.agent_id,
      job_type: options.jobType,
      zpl_data: zpl,
      copies: options.copies || 1,
      status: "pending",
      created_by: options.userId,
    })
    .select("id")
    .single();

  if (insertError || !job) {
    return {
      success: false,
      error: "Failed to create print job",
    };
  }

  // Try to push the job to the connected agent via WebSocket
  const pushed = agentConnectionManager.pushJob(printer.agent_id, {
    jobId: job.id,
    printerId: printer.id,
    usbDeviceId: printer.usb_device_id || undefined,
    zpl,
    copies: options.copies || 1,
  });

  if (pushed) {
    // Update job status to 'sent'
    await supabase
      .from("print_queue")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  // Return success - the job is queued even if not immediately pushed
  // Agent will pick it up when it reconnects if not pushed now
  return {
    success: true,
    jobId: job.id,
  };
}

/**
 * Low-level function to send raw data to a network printer via TCP socket.
 */
function sendRawToPrinter(host: string, port: number, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.setTimeout(5000);

    client.connect(port, host, () => {
      client.write(data, "utf8", () => {
        client.end();
      });
    });

    client.on("error", (err) => {
      client.destroy();
      reject(err);
    });

    client.on("timeout", () => {
      client.destroy();
      reject(new Error("Printer connection timed out."));
    });

    client.on("close", () => resolve());
  });
}

export { sendRawToPrinter };
