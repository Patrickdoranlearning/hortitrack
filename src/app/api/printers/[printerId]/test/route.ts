export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

export async function POST(
  _req: NextRequest,
  { params }: { params: { printerId: string } }
) {
  try {
    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ error: "No active organization" }, { status: 401 });
    }

    // Fetch printer config
    const { data: printer, error } = await supabase
      .from("printers")
      .select("*")
      .eq("id", params.printerId)
      .eq("org_id", orgId)
      .single();

    if (error || !printer) {
      return NextResponse.json({ error: "Printer not found" }, { status: 404 });
    }

    if (printer.connection_type !== "network" || !printer.host) {
      return NextResponse.json({ 
        error: "Test only supported for network printers with configured host" 
      }, { status: 400 });
    }

    // Simple test: try to connect and send a test label
    const testZpl = [
      "^XA",
      "^CF0,40",
      "^FO50,50^FDPrinter Test^FS",
      "^CF0,30",
      `^FO50,100^FD${printer.name}^FS`,
      `^FO50,140^FD${new Date().toLocaleString()}^FS`,
      "^FO50,190^FDIf you see this, the printer is working!^FS",
      "^XZ",
    ].join("\n");

    await sendTestToPrinter(printer.host, printer.port || 9100, testZpl);

    return NextResponse.json({ 
      success: true, 
      message: "Test label sent successfully" 
    });
  } catch (e: any) {
    console.error("[api/printers/[id]/test] error:", e);
    return NextResponse.json({ 
      error: e?.message || "Failed to test printer",
      success: false 
    }, { status: 500 });
  }
}

function sendTestToPrinter(host: string, port: number, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(5000);

    client.connect(port, host, () => {
      client.write(data, "utf8", () => {
        client.end();
      });
    });

    client.on("error", (err) => {
      client.destroy();
      reject(err);
    });

    client.on("timeout", () => {
      client.destroy();
      reject(new Error("Connection timed out"));
    });

    client.on("close", () => resolve());
  });
}



