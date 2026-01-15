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
 * Print on Windows using raw printing via PowerShell.
 * Uses the Windows printing API to send raw data directly to the printer.
 */
async function printWindows(printerName: string | undefined, zpl: string): Promise<void> {
  // Create temp file with ZPL data
  const tempFile = path.join(tmpdir(), `hortitrack-print-${Date.now()}.zpl`);

  try {
    await writeFile(tempFile, zpl, "utf8");

    // Use PowerShell to send raw data to printer using .NET printing API
    // This approach works reliably on Windows without needing lpr or shared printers
    const escapedPath = tempFile.replace(/\\/g, "\\\\");
    const escapedPrinterName = printerName ? printerName.replace(/"/g, '`"') : "";

    const psScript = `
$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static void SendRawData(string printerName, byte[] data) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            throw new Exception("Failed to open printer: " + printerName);
        }
        try {
            DOCINFO di = new DOCINFO();
            di.pDocName = "Hortitrack Label";
            di.pDataType = "RAW";
            if (!StartDocPrinter(hPrinter, 1, ref di)) {
                throw new Exception("StartDocPrinter failed");
            }
            try {
                if (!StartPagePrinter(hPrinter)) {
                    throw new Exception("StartPagePrinter failed");
                }
                try {
                    int written;
                    if (!WritePrinter(hPrinter, data, data.Length, out written)) {
                        throw new Exception("WritePrinter failed");
                    }
                } finally {
                    EndPagePrinter(hPrinter);
                }
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@

$content = [System.IO.File]::ReadAllBytes("${escapedPath}")
$printerName = "${escapedPrinterName}"

if ([string]::IsNullOrEmpty($printerName)) {
    # Get default printer
    $printerName = (Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=$true").Name
    if ([string]::IsNullOrEmpty($printerName)) {
        throw "No default printer found"
    }
}

[RawPrinter]::SendRawData($printerName, $content)
Write-Host "Print job sent successfully to $printerName"
`;

    // Execute PowerShell script
    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, " ")}"`, {
      shell: "cmd.exe",
      timeout: 30000,
    });

    console.log(`[PrintHandler] Successfully sent print job to ${printerName || "default printer"}`);
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
