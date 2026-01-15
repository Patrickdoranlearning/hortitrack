export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import {
  buildSaleLabelZpl,
  buildSaleLabelZplWithTemplate,
  type SaleLabelInput,
  type SaleLabelTemplate,
} from "@/server/labels/build-sale-label";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { sendToPrinter } from "@/server/labels/send-to-printer";

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

    // Get current user for tracking
    const { data: { user } } = await supabase.auth.getUser();

    // Send to printer (handles both network and agent-connected printers)
    const result = await sendToPrinter(printer, zpl, {
      jobType: "sale",
      orgId,
      userId: user?.id,
      copies,
    });

    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: result.error || "Print failed"
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, copies, jobId: result.jobId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Print failed";
    console.error("[api/labels/print-sale] error:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}







