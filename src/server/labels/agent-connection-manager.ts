import type { WebSocket } from "ws";
import { logger } from "@/server/utils/logger";

export interface PrintJob {
  jobId: string;
  printerId: string;
  usbDeviceId?: string;
  zpl: string;
  copies: number;
}

interface ConnectedAgent {
  agentId: string;
  orgId: string;
  ws: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
}

/**
 * Manages WebSocket connections from print agents.
 * This is a singleton that maintains active connections and routes print jobs.
 */
class AgentConnectionManager {
  private connections: Map<string, ConnectedAgent> = new Map();

  /**
   * Register a new agent connection.
   */
  registerAgent(agentId: string, orgId: string, ws: WebSocket): void {
    // Close existing connection if any
    const existing = this.connections.get(agentId);
    if (existing) {
      try {
        existing.ws.close();
      } catch {
        // Ignore close errors
      }
    }

    this.connections.set(agentId, {
      agentId,
      orgId,
      ws,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    });

    logger.labels.info("Print agent connected", { agentId });
  }

  /**
   * Remove an agent connection.
   */
  removeAgent(agentId: string): void {
    this.connections.delete(agentId);
    logger.labels.info("Print agent disconnected", { agentId });
  }

  /**
   * Update heartbeat timestamp for an agent.
   */
  updateHeartbeat(agentId: string): void {
    const agent = this.connections.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  /**
   * Check if an agent is currently connected.
   */
  isAgentConnected(agentId: string): boolean {
    const agent = this.connections.get(agentId);
    if (!agent) return false;

    // Check if connection is still alive (heartbeat within last 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return agent.lastHeartbeat > twoMinutesAgo;
  }

  /**
   * Push a print job to a connected agent.
   * Returns true if the job was sent, false if agent is not connected.
   */
  pushJob(agentId: string, job: PrintJob): boolean {
    const agent = this.connections.get(agentId);
    if (!agent) {
      logger.labels.warn("Cannot push job - agent not connected", { agentId });
      return false;
    }

    try {
      const message = JSON.stringify({
        type: "print_job",
        jobId: job.jobId,
        printerId: job.printerId,
        usbDeviceId: job.usbDeviceId,
        zpl: job.zpl,
        copies: job.copies,
      });

      agent.ws.send(message);
      logger.labels.info("Pushed print job to agent", { jobId: job.jobId, agentId });
      return true;
    } catch (e) {
      logger.labels.error("Failed to push job to agent", e, { agentId, jobId: job.jobId });
      // Remove the broken connection
      this.removeAgent(agentId);
      return false;
    }
  }

  /**
   * Send a test print request to an agent.
   */
  sendTestPrint(agentId: string, printerId: string, usbDeviceId: string | undefined, zpl: string): boolean {
    const agent = this.connections.get(agentId);
    if (!agent) return false;

    try {
      const message = JSON.stringify({
        type: "test_printer",
        printerId,
        usbDeviceId,
        zpl,
      });

      agent.ws.send(message);
      return true;
    } catch {
      this.removeAgent(agentId);
      return false;
    }
  }

  /**
   * Get the WebSocket connection for an agent.
   */
  getConnection(agentId: string): WebSocket | undefined {
    return this.connections.get(agentId)?.ws;
  }

  /**
   * Get all connected agent IDs for an organization.
   */
  getConnectedAgentsForOrg(orgId: string): string[] {
    const agentIds: string[] = [];
    for (const [agentId, agent] of this.connections) {
      if (agent.orgId === orgId && this.isAgentConnected(agentId)) {
        agentIds.push(agentId);
      }
    }
    return agentIds;
  }

  /**
   * Get count of connected agents.
   */
  getConnectedCount(): number {
    return this.connections.size;
  }
}

// Export singleton instance
export const agentConnectionManager = new AgentConnectionManager();
