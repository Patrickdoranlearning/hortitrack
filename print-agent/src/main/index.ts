import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from "electron";
import path from "path";
import Store from "electron-store";
import { PrintAgentClient } from "./agent-client";
import { PrinterDiscovery } from "./printer-discovery";

// Configuration store
const store = new Store<{
  serverUrl: string;
  agentKey: string;
  autoStart: boolean;
}>();

// Global references
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let agentClient: PrintAgentClient | null = null;
let printerDiscovery: PrinterDiscovery | null = null;

// App state
let isConnected = false;
let lastError: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 600,
    show: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("close", (event) => {
    // Hide instead of close when clicking X
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray(): void {
  // Create tray icon (use a placeholder, replace with actual icon)
  const iconPath = path.join(__dirname, "../../build/tray-icon.png");
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback: create a simple colored icon
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Hortitrack Print Agent");

  updateTrayMenu();

  tray.on("click", () => {
    mainWindow?.show();
  });
}

function updateTrayMenu(): void {
  if (!tray) return;

  const statusText = isConnected ? "Connected" : lastError ? `Error: ${lastError}` : "Disconnected";
  const statusIcon = isConnected ? "🟢" : "🔴";

  const contextMenu = Menu.buildFromTemplate([
    { label: `${statusIcon} ${statusText}`, enabled: false },
    { type: "separator" },
    {
      label: "Open Settings",
      click: () => mainWindow?.show(),
    },
    {
      label: "Reconnect",
      enabled: !isConnected,
      click: () => startAgent(),
    },
    { type: "separator" },
    {
      label: "View Logs",
      click: () => shell.openPath(app.getPath("logs")),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        agentClient?.disconnect();
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function updateTrayIcon(connected: boolean): void {
  isConnected = connected;
  updateTrayMenu();

  // Update tooltip
  tray?.setToolTip(
    connected ? "Hortitrack Print Agent - Connected" : "Hortitrack Print Agent - Disconnected"
  );
}

async function startAgent(): Promise<void> {
  const serverUrl = store.get("serverUrl");
  const agentKey = store.get("agentKey");

  if (!serverUrl || !agentKey) {
    console.log("[Agent] Missing configuration, showing settings window");
    mainWindow?.show();
    return;
  }

  // Initialize printer discovery
  printerDiscovery = new PrinterDiscovery();

  // Initialize agent client
  agentClient = new PrintAgentClient({
    serverUrl,
    agentKey,
    printerDiscovery,
    onConnected: () => {
      console.log("[Agent] Connected to server");
      updateTrayIcon(true);
      lastError = null;
      // Notify renderer
      mainWindow?.webContents.send("agent-status", { connected: true });
    },
    onDisconnected: (reason) => {
      console.log("[Agent] Disconnected:", reason);
      updateTrayIcon(false);
      lastError = reason || null;
      // Notify renderer
      mainWindow?.webContents.send("agent-status", { connected: false, error: reason });
    },
    onPrintJob: async (job) => {
      console.log("[Agent] Received print job:", job.jobId);
      // Notify renderer about the job
      mainWindow?.webContents.send("print-job", job);
    },
  });

  try {
    await agentClient.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    console.error("[Agent] Failed to connect:", message);
    lastError = message;
    updateTrayIcon(false);
  }
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Start agent if configured
  const serverUrl = store.get("serverUrl");
  const agentKey = store.get("agentKey");

  if (serverUrl && agentKey) {
    startAgent();
  } else {
    mainWindow?.show();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Don't quit on macOS
  if (process.platform !== "darwin") {
    // Keep running in tray
  }
});

app.on("before-quit", () => {
  agentClient?.disconnect();
});

// Handle IPC from renderer
import { ipcMain } from "electron";

ipcMain.handle("get-config", () => {
  return {
    serverUrl: store.get("serverUrl", ""),
    agentKey: store.get("agentKey", ""),
    autoStart: store.get("autoStart", true),
  };
});

ipcMain.handle("save-config", async (_event, config: { serverUrl: string; agentKey: string; autoStart: boolean }) => {
  store.set("serverUrl", config.serverUrl);
  store.set("agentKey", config.agentKey);
  store.set("autoStart", config.autoStart);

  // Restart agent with new config
  agentClient?.disconnect();
  await startAgent();

  return { success: true };
});

ipcMain.handle("get-status", () => {
  return {
    connected: isConnected,
    error: lastError,
    printers: printerDiscovery?.getDiscoveredPrinters() || [],
  };
});

ipcMain.handle("reconnect", async () => {
  agentClient?.disconnect();
  await startAgent();
  return { success: true };
});

ipcMain.handle("get-printers", () => {
  return printerDiscovery?.getDiscoveredPrinters() || [];
});
