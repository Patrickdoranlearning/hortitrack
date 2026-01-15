import { contextBridge, ipcRenderer } from "electron";

// Expose API to renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // Configuration
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config: { serverUrl: string; agentKey: string; autoStart: boolean }) =>
    ipcRenderer.invoke("save-config", config),

  // Status
  getStatus: () => ipcRenderer.invoke("get-status"),
  reconnect: () => ipcRenderer.invoke("reconnect"),

  // Printers
  getPrinters: () => ipcRenderer.invoke("get-printers"),

  // Events
  onAgentStatus: (callback: (status: { connected: boolean; error?: string }) => void) => {
    ipcRenderer.on("agent-status", (_event, status) => callback(status));
  },

  onPrintJob: (callback: (job: { jobId: string; printerId: string }) => void) => {
    ipcRenderer.on("print-job", (_event, job) => callback(job));
  },
});

// Type definitions for renderer
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<{ serverUrl: string; agentKey: string; autoStart: boolean }>;
      saveConfig: (config: { serverUrl: string; agentKey: string; autoStart: boolean }) => Promise<{ success: boolean }>;
      getStatus: () => Promise<{ connected: boolean; error?: string; printers: unknown[] }>;
      reconnect: () => Promise<{ success: boolean }>;
      getPrinters: () => Promise<unknown[]>;
      onAgentStatus: (callback: (status: { connected: boolean; error?: string }) => void) => void;
      onPrintJob: (callback: (job: { jobId: string; printerId: string }) => void) => void;
    };
  }
}
