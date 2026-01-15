import { exec, spawn } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const execAsync = promisify(exec);

/**
 * Send ZPL data to a printer.
 *
 * @param printerName - Name of the printer (optional, uses default if not specified)
 * @param zpl - ZPL commands to send
 * @param copies - Number of copies (handled by ZPL ^PQ command)
 */
export async function printZpl(
  printerName: string | undefined,
  zpl: string,
  copies: number = 1
): Promise<void> {
  console.log(`[PrintHandler] Printing to: ${printerName || "default"}, copies: ${copies}`);

  switch (process.platform) {
    case "win32":
      await printWindows(printerName, zpl);
      break;
    case "darwin":
      await printMac(printerName, zpl);
      break;
    case "linux":
      await printLinux(printerName, zpl);
      break;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/**
 * Print on Windows using raw printing.
 */
async function printWindows(printerName: string | undefined, zpl: string): Promise<void> {
  // Create temp file with ZPL data
  const tempFile = path.join(tmpdir(), `hortitrack-print-${Date.now()}.zpl`);

  try {
    await writeFile(tempFile, zpl, "utf8");

    // Use PowerShell to send raw data to printer
    const printer = printerName ? `-PrinterName "${printerName}"` : "";
    const command = `
      $content = Get-Content -Path "${tempFile}" -Raw
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)

      Add-Type -AssemblyName System.Drawing
      $printerSettings = New-Object System.Drawing.Printing.PrinterSettings
      ${printerName ? `$printerSettings.PrinterName = "${printerName}"` : ""}

      # Open raw print job
      $docInfo = New-Object System.Drawing.Printing.PrintDocument
      ${printerName ? `$docInfo.PrinterSettings.PrinterName = "${printerName}"` : ""}

      # Alternative: Use copy command for raw printing
      copy /b "${tempFile}" "\\\\localhost\\${printerName || '$null'}" 2>$null
      if ($LASTEXITCODE -ne 0) {
        # Fallback to lpr if available
        lpr -S localhost ${printerName ? `-P "${printerName}"` : ""} "${tempFile}"
      }
    `.trim();

    // Simpler approach: use raw copy or lpr
    const simplePrint = printerName
      ? `copy /b "${tempFile}" "\\\\%COMPUTERNAME%\\${printerName}"`
      : `type "${tempFile}" | lpr`;

    await execAsync(simplePrint, { shell: "cmd.exe" });
  } finally {
    // Clean up temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Print on macOS using lp command.
 */
async function printMac(printerName: string | undefined, zpl: string): Promise<void> {
  const tempFile = path.join(tmpdir(), `hortitrack-print-${Date.now()}.zpl`);

  try {
    await writeFile(tempFile, zpl, "utf8");

    // Use lp command
    const printerArg = printerName ? `-d "${printerName}"` : "";
    const command = `lp ${printerArg} -o raw "${tempFile}"`;

    await execAsync(command);
  } finally {
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Print on Linux using lp command.
 */
async function printLinux(printerName: string | undefined, zpl: string): Promise<void> {
  // Linux uses the same CUPS system as macOS
  return printMac(printerName, zpl);
}

/**
 * Send raw data directly to a network printer.
 * This bypasses the OS print spooler and sends data directly via TCP.
 */
export async function printToNetworkPrinter(
  host: string,
  port: number,
  zpl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const net = require("net");
    const client = new net.Socket();

    client.setTimeout(10000);

    client.connect(port, host, () => {
      client.write(zpl, "utf8", () => {
        client.end();
      });
    });

    client.on("error", (err: Error) => {
      client.destroy();
      reject(err);
    });

    client.on("timeout", () => {
      client.destroy();
      reject(new Error("Connection timed out"));
    });

    client.on("close", () => {
      resolve();
    });
  });
}

/**
 * Test if a printer is accessible.
 */
export async function testPrinter(printerName: string): Promise<boolean> {
  try {
    // Try to print a minimal ZPL test
    const testZpl = "^XA^FO50,50^A0N,30,30^FDTest^FS^XZ";
    await printZpl(printerName, testZpl);
    return true;
  } catch (error) {
    console.error(`[PrintHandler] Printer test failed for ${printerName}:`, error);
    return false;
  }
}
