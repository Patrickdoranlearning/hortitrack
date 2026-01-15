import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } from "electron";
import path from "path";
import Store from "electron-store";
import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";
import { PrintAgentClient } from "./agent-client";
import { PrinterDiscovery } from "./printer-discovery";

// Configuration store
const store = new Store<{
  serverUrl: string;
  agentKey: string;
  autoStart: boolean;
  autoUpdate: boolean;
}>();

// Global references
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let agentClient: PrintAgentClient | null = null;
let printerDiscovery: PrinterDiscovery | null = null;

// App state
let isConnected = false;
let lastError: string | null = null;
let updateAvailable = false;
let updateDownloaded = false;
let updateInfo: UpdateInfo | null = null;

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

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    { label: `${statusIcon} ${statusText}`, enabled: false },
    { label: `Version ${app.getVersion()}`, enabled: false },
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
  ];

  // Add update menu items
  if (updateDownloaded && updateInfo) {
    menuItems.push({
      label: `Install Update (v${updateInfo.version})`,
      click: () => autoUpdater.quitAndInstall(),
    });
  } else if (updateAvailable && updateInfo) {
    menuItems.push({
      label: `Downloading v${updateInfo.version}...`,
      enabled: false,
    });
  } else {
    menuItems.push({
      label: "Check for Updates",
      click: () => checkForUpdates(),
    });
  }

  menuItems.push(
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
    }
  );

  const contextMenu = Menu.buildFromTemplate(menuItems);
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

// Auto-update functions
function setupAutoUpdater(): void {
  // Skip auto-updater in development mode
  if (!app.isPackaged) {
    console.log("[AutoUpdater] Skipping setup - running in development mode");
    return;
  }

  // Configure auto-updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[AutoUpdater] Checking for updates...");
    mainWindow?.webContents.send("update-status", { status: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("[AutoUpdater] Update available:", info.version);
    updateAvailable = true;
    updateInfo = info;
    mainWindow?.webContents.send("update-status", {
      status: "available",
      version: info.version,
    });
    updateTrayMenu();
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[AutoUpdater] No updates available");
    mainWindow?.webContents.send("update-status", { status: "not-available" });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    mainWindow?.webContents.send("update-status", {
      status: "downloading",
      percent: progress.percent,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log("[AutoUpdater] Update downloaded:", info.version);
    updateDownloaded = true;
    updateInfo = info;
    mainWindow?.webContents.send("update-status", {
      status: "downloaded",
      version: info.version,
    });
    updateTrayMenu();

    // Show notification to user
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: `Version ${info.version} has been downloaded.`,
      detail: "The update will be installed when you quit the application. Would you like to restart now?",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (error: Error) => {
    console.error("[AutoUpdater] Error:", error);
    mainWindow?.webContents.send("update-status", {
      status: "error",
      error: error.message,
    });
  });
}

function checkForUpdates(): void {
  // Skip in development mode
  if (!app.isPackaged) {
    console.log("[AutoUpdater] Skipping update check - running in development mode");
    return;
  }

  if (store.get("autoUpdate", true)) {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error("[AutoUpdater] Failed to check for updates:", err);
    });
  }
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

  // Setup auto-updater
  setupAutoUpdater();

  // Check for updates on startup (after a short delay to not slow down launch)
  setTimeout(() => {
    checkForUpdates();
  }, 3000);

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

// Auto-update IPC handlers
ipcMain.handle("get-update-status", () => {
  return {
    updateAvailable,
    updateDownloaded,
    version: updateInfo?.version || null,
    currentVersion: app.getVersion(),
    autoUpdate: store.get("autoUpdate", true),
  };
});

ipcMain.handle("check-for-updates", () => {
  checkForUpdates();
  return { success: true };
});

ipcMain.handle("install-update", () => {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall();
  }
  return { success: updateDownloaded };
});

ipcMain.handle("set-auto-update", (_event, enabled: boolean) => {
  store.set("autoUpdate", enabled);
  return { success: true };
});
