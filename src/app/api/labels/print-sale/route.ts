export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import net from "net";
import { 
  buildSaleLabelZpl, 
  buildSaleLabelZplWithTemplate,
  type SaleLabelInput,
  type SaleLabelTemplate,
} from "@/server/labels/build-sale-label";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      productTitle, 
      size, 
      priceText, 
      barcode,
      symbology = "code128",
      footerSmall,
      lotNumber,
      printerId,
      templateId,
      copies = 1,
    } = body;

    // Validate required fields
    if (!productTitle || !priceText || !barcode) {
      return NextResponse.json({ 
        ok: false, 
        error: "productTitle, priceText, and barcode are required" 
      }, { status: 400 });
    }

    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "No active organization" }, { status: 401 });
    }

    // Get printer configuration
    let printer;
    if (printerId) {
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .eq("id", printerId)
        .eq("org_id", orgId)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ ok: false, error: "Printer not found" }, { status: 404 });
      }
      printer = data;
    } else {
      // Get default printer
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_default", true)
        .eq("is_active", true)
        .single();
      
      if (error || !data) {
        // Fallback to env vars if no default printer configured
        const envHost = process.env.PRINTER_HOST;
        if (!envHost) {
          return NextResponse.json({ 
            ok: false, 
            error: "No printer configured. Please add a printer in settings." 
          }, { status: 400 });
        }
        printer = {
          host: envHost,
          port: Number(process.env.PRINTER_PORT || 9100),
          dpi: 203,
        };
      } else {
        printer = data;
      }
    }

    // Get template if specified
    let template: SaleLabelTemplate | null = null;
    if (templateId) {
      const { data, error } = await supabase
        .from("label_templates")
        .select("*")
        .eq("id", templateId)
        .eq("org_id", orgId)
        .single();
      
      if (!error && data) {
        template = {
          width_mm: data.width_mm,
          height_mm: data.height_mm,
          margin_mm: data.margin_mm ?? 3,
          dpi: data.dpi ?? 203,
          zpl_template: data.zpl_template,
          layout: data.layout,
        };
      }
    }

    // Build sale label input
    const labelInput: SaleLabelInput = {
      productTitle,
      size: size ?? "",
      priceText,
      barcode,
      symbology,
      footerSmall: footerSmall ?? "Grown in Ireland – Doran Nurseries",
      lotNumber,
    };

    // Build ZPL
    let zpl: string;
    if (template) {
      zpl = buildSaleLabelZplWithTemplate(labelInput, template, copies);
    } else {
      zpl = buildSaleLabelZpl({ ...labelInput, qty: copies });
    }

    // Check connection type and send to printer
    if (printer.connection_type === "network" || !printer.connection_type) {
      if (!printer.host) {
        return NextResponse.json({ 
          ok: false, 
          error: "Printer host is not configured" 
        }, { status: 400 });
      }
      await sendRawToPrinter(printer.host, printer.port || 9100, zpl);
    } else {
      return NextResponse.json({ 
        ok: false, 
        error: `Connection type '${printer.connection_type}' not yet supported` 
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, copies });
  } catch (e: any) {
    console.error("[api/labels/print-sale] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Print failed" }, { status: 500 });
  }
}

function sendRawToPrinter(host: string, port: number, data: string): Promise<void> {
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

    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Printer connection timed out.'));
    });

    client.on("close", () => resolve());
  });
}

