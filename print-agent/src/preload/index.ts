import { contextBridge, ipcRenderer } from "electron";

// Update status type
interface UpdateStatus {
  status: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  error?: string;
}

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

  // Auto-update
  getUpdateStatus: () => ipcRenderer.invoke("get-update-status"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  setAutoUpdate: (enabled: boolean) => ipcRenderer.invoke("set-auto-update", enabled),

  // Events
  onAgentStatus: (callback: (status: { connected: boolean; error?: string }) => void) => {
    ipcRenderer.on("agent-status", (_event, status) => callback(status));
  },

  onPrintJob: (callback: (job: { jobId: string; printerId: string }) => void) => {
    ipcRenderer.on("print-job", (_event, job) => callback(job));
  },

  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    ipcRenderer.on("update-status", (_event, status) => callback(status));
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
      getUpdateStatus: () => Promise<{
        updateAvailable: boolean;
        updateDownloaded: boolean;
        version: string | null;
        currentVersion: string;
        autoUpdate: boolean;
      }>;
      checkForUpdates: () => Promise<{ success: boolean }>;
      installUpdate: () => Promise<{ success: boolean }>;
      setAutoUpdate: (enabled: boolean) => Promise<{ success: boolean }>;
      onAgentStatus: (callback: (status: { connected: boolean; error?: string }) => void) => void;
      onPrintJob: (callback: (job: { jobId: string; printerId: string }) => void) => void;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => void;
    };
  }
}
