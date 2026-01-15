import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DiscoveredPrinter {
  name: string;
  deviceId?: string;
  isDefault: boolean;
  status: "ready" | "offline" | "unknown";
}

/**
 * Discovers printers connected to the system.
 * Works across Windows, macOS, and Linux.
 */
export class PrinterDiscovery {
  private cachedPrinters: DiscoveredPrinter[] = [];
  private lastDiscovery: number = 0;
  private cacheTimeout = 30000; // 30 seconds

  constructor() {
    // Initial discovery
    this.discoverPrinters();

    // Refresh periodically
    setInterval(() => {
      this.discoverPrinters();
    }, this.cacheTimeout);
  }

  /**
   * Get the list of discovered printers.
   * Returns cached results if recent, otherwise triggers new discovery.
   */
  getDiscoveredPrinters(): DiscoveredPrinter[] {
    const now = Date.now();
    if (now - this.lastDiscovery > this.cacheTimeout) {
      this.discoverPrinters();
    }
    return this.cachedPrinters;
  }

  /**
   * Force a refresh of the printer list.
   */
  async refresh(): Promise<DiscoveredPrinter[]> {
    await this.discoverPrinters();
    return this.cachedPrinters;
  }

  /**
   * Discover printers based on the current platform.
   */
  private async discoverPrinters(): Promise<void> {
    try {
      let printers: DiscoveredPrinter[];

      switch (process.platform) {
        case "win32":
          printers = await this.discoverWindowsPrinters();
          break;
        case "darwin":
          printers = await this.discoverMacPrinters();
          break;
        case "linux":
          printers = await this.discoverLinuxPrinters();
          break;
        default:
          console.warn(`[PrinterDiscovery] Unsupported platform: ${process.platform}`);
          printers = [];
      }

      this.cachedPrinters = printers;
      this.lastDiscovery = Date.now();

      console.log(`[PrinterDiscovery] Found ${printers.length} printers`);
    } catch (error) {
      console.error("[PrinterDiscovery] Error discovering printers:", error);
    }
  }

  /**
   * Discover printers on Windows using PowerShell.
   */
  private async discoverWindowsPrinters(): Promise<DiscoveredPrinter[]> {
    try {
      // Use -NoProfile and -ExecutionPolicy Bypass to avoid policy issues
      const { stdout, stderr } = await execAsync(
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json -Compress"',
        { timeout: 10000 }
      );

      if (stderr) {
        console.warn("[PrinterDiscovery] Windows discovery stderr:", stderr);
      }

      const trimmedOutput = (stdout || "").trim();
      if (!trimmedOutput) {
        console.log("[PrinterDiscovery] No printers returned from Get-Printer");
        return [];
      }

      // Handle case where PowerShell returns nothing or just whitespace
      let printers;
      try {
        printers = JSON.parse(trimmedOutput);
      } catch (parseError) {
        console.error("[PrinterDiscovery] Failed to parse JSON:", trimmedOutput);
        return [];
      }

      // Ensure we always have an array (single printer returns object, not array)
      const printerArray = Array.isArray(printers) ? printers : (printers ? [printers] : []);

      console.log(`[PrinterDiscovery] Raw printer data:`, JSON.stringify(printerArray));

      return printerArray
        .filter((p: { Name?: string }) => p && p.Name) // Filter out any null/undefined entries
        .map((p: { Name: string; Default: boolean; PrinterStatus: number }) => ({
          name: p.Name,
          isDefault: p.Default === true,
          status: p.PrinterStatus === 0 ? "ready" as const : "offline" as const,
        }));
    } catch (error) {
      console.error("[PrinterDiscovery] Windows discovery error:", error);
      return [];
    }
  }

  /**
   * Discover printers on macOS using lpstat.
   */
  private async discoverMacPrinters(): Promise<DiscoveredPrinter[]> {
    try {
      // Get list of printers
      const { stdout: lpstatOutput } = await execAsync("lpstat -p 2>/dev/null || true");

      // Get default printer
      const { stdout: defaultOutput } = await execAsync("lpstat -d 2>/dev/null || true");
      const defaultPrinter = defaultOutput.match(/system default destination: (.+)/)?.[1]?.trim();

      const printers: DiscoveredPrinter[] = [];
      const lines = lpstatOutput.split("\n");

      for (const line of lines) {
        const match = line.match(/^printer (.+?) is/);
        if (match) {
          const name = match[1];
          const isIdle = line.includes("idle");
          printers.push({
            name,
            isDefault: name === defaultPrinter,
            status: isIdle ? "ready" : "unknown",
          });
        }
      }

      return printers;
    } catch (error) {
      console.error("[PrinterDiscovery] macOS discovery error:", error);
      return [];
    }
  }

  /**
   * Discover printers on Linux using lpstat.
   */
  private async discoverLinuxPrinters(): Promise<DiscoveredPrinter[]> {
    // Linux uses the same CUPS system as macOS
    return this.discoverMacPrinters();
  }

  /**
   * Find a printer by name (case-insensitive, partial match).
   */
  findPrinter(name: string): DiscoveredPrinter | undefined {
    const lowerName = name.toLowerCase();
    return this.cachedPrinters.find(
      (p) =>
        p.name.toLowerCase() === lowerName ||
        p.name.toLowerCase().includes(lowerName)
    );
  }

  /**
   * Get the default printer.
   */
  getDefaultPrinter(): DiscoveredPrinter | undefined {
    return this.cachedPrinters.find((p) => p.isDefault);
  }
}
