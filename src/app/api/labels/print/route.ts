
import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { buildZpl } from "@/server/labels/build-batch-label";

const PRINTER_HOST = process.env.PRINTER_HOST!; // e.g. 192.168.1.50
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const zpl = buildZpl(body);

    if (!PRINTER_HOST) {
        throw new Error("Printer host is not configured. Set PRINTER_HOST environment variable.");
    }

    await sendRawToPrinter(zpl);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Print error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Print failed" }, { status: 500 });
  }
}

function sendRawToPrinter(data: string) {
  return new Promise<void>((resolve, reject) => {
    const client = new net.Socket();
    
    client.setTimeout(5000);

    client.connect(PRINTER_PORT, PRINTER_HOST, () => {
      client.write(data, "utf8", () => {
        client.end();
      });
    });
    
    client.on("error", (err) => {
        client.destroy();
        reject(err);
    });

    client.on('timeout', () => {
        client.destroy();
        reject(new Error('Printer connection timed out.'));
    });

    client.on("close", () => resolve());
  });
}
