import { PrinterDiscovery, DiscoveredPrinter } from "./printer-discovery";
import { printZpl } from "./print-handler";

export interface PrintJob {
  jobId: string;
  printerId: string;
  usbDeviceId?: string;
  usbDeviceName?: string;
  zpl: string;
  copies: number;
}

export interface AgentClientOptions {
  serverUrl: string;
  agentKey: string;
  printerDiscovery: PrinterDiscovery;
  onConnected: () => void;
  onDisconnected: (reason?: string) => void;
  onPrintJob: (job: PrintJob) => void;
}

interface WorkstationInfo {
  hostname: string;
  platform: string;
  osVersion: string;
  agentVersion: string;
}

/**
 * Client that connects to the Hortitrack server to receive print jobs.
 * Uses HTTP polling as a fallback since WebSocket requires custom server setup.
 */
export class PrintAgentClient {
  private options: AgentClientOptions;
  private pollInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(options: AgentClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    try {
      // Authenticate with server
      const response = await this.sendRequest("auth", {
        workstationInfo: this.getWorkstationInfo(),
      });

      if (response.type === "auth_success") {
        console.log(`[AgentClient] Authenticated as: ${response.agentName}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.options.onConnected();

        // Start polling for jobs
        this.startPolling();
      } else {
        const err =
          typeof (response as any)?.error === "string"
            ? (response as any).error
            : "Authentication failed";
        throw new Error(err);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      console.error("[AgentClient] Connection error:", message);
      this.options.onDisconnected(message);
      this.scheduleReconnect();
      throw error;
    }
  }

  disconnect(): void {
    this.isConnected = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Notify server we're going offline
    this.sendRequest("offline", {}).catch(() => {
      // Ignore errors when going offline
    });

    this.options.onDisconnected("User disconnected");
  }

  private startPolling(): void {
    // Poll every 3 seconds for new jobs
    this.pollInterval = setInterval(() => {
      this.poll();
    }, 3000);

    // Initial poll
    this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const printers = this.options.printerDiscovery.getDiscoveredPrinters();

      const response = await this.sendRequest("heartbeat", {
        connectedPrinters: printers,
      });

      if (response.type === "heartbeat_ack") {
        // Process any pending jobs
        const jobs = response.jobs as PrintJob[];
        for (const job of jobs) {
          await this.handlePrintJob(job);
        }
      }

      // Reset reconnect counter on successful poll
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error("[AgentClient] Poll error:", error);
      this.handleConnectionError();
    }
  }

  private async handlePrintJob(job: PrintJob): Promise<void> {
    console.log(`[AgentClient] Processing job ${job.jobId}`);

    try {
      // Notify UI about the job
      this.options.onPrintJob(job);

      // Find the printer to use
      const printerName = job.usbDeviceName || job.usbDeviceId;

      // Execute the print
      await printZpl(printerName || undefined, job.zpl, job.copies);

      // Report success
      await this.sendRequest("job_result", {
        jobId: job.jobId,
        status: "completed",
      });

      console.log(`[AgentClient] Job ${job.jobId} completed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Print failed";
      console.error(`[AgentClient] Job ${job.jobId} failed:`, message);

      // Report failure
      await this.sendRequest("job_result", {
        jobId: job.jobId,
        status: "failed",
        error: message,
      });
    }
  }

  private handleConnectionError(): void {
    if (!this.isConnected) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[AgentClient] Max reconnect attempts reached");
      this.isConnected = false;
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      this.options.onDisconnected("Connection lost - max retries exceeded");
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`[AgentClient] Reconnecting in ${delay}ms...`);

    setTimeout(() => {
      this.connect().catch(() => {
        // Error already handled
      });
    }, delay);
  }

  private async sendRequest(action: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = `${this.options.serverUrl}/api/print-agents/ws`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        agentKey: this.options.agentKey,
        ...data,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private getWorkstationInfo(): WorkstationInfo {
    const os = require("os");
    const pkg = require("../../package.json");

    return {
      hostname: os.hostname(),
      platform: process.platform,
      osVersion: os.release(),
      agentVersion: pkg.version,
    };
  }
}
