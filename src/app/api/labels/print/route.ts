export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { buildZpl, buildZplWithTemplate, buildZplRow } from "@/server/labels/build-batch-label";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { sendToPrinter } from "@/server/labels/send-to-printer";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Rate limit: 30 print requests per minute per user
    const rlKey = `print:labels:${requestKey(req, user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 30 });
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const {
      batchId,
      batchNumber: providedBatchNumber,
      variety: providedVariety,
      family: providedFamily,
      quantity: providedQuantity,
      size: providedSize,
      location: providedLocation,
      payload,
      printerId,
      templateId,
      copies = 1,
    } = body;

    // If batchId provided, fetch batch data from DB
    let batchNumber = providedBatchNumber;
    let variety = providedVariety;
    let family = providedFamily;
    let quantity = providedQuantity;
    let size = providedSize;
    let location = providedLocation;

    if (batchId) {
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .select(`
          batch_number,
          quantity,
          plant_varieties (name, family),
          plant_sizes (name),
          nursery_locations:location_id (name)
        `)
        .eq("id", batchId)
        .eq("org_id", orgId)
        .single();

      if (batchError || !batch) {
        return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
      }

      // Use DB values, but allow overrides from request
      batchNumber = batchNumber || batch.batch_number;
      variety = variety || (batch.plant_varieties as any)?.name;
      family = family || (batch.plant_varieties as any)?.family;
      quantity = quantity ?? batch.quantity;
      size = size || (batch.plant_sizes as any)?.name;
      location = location || (batch.nursery_locations as any)?.name;
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
    let template = null;
    if (templateId) {
      const { data, error } = await supabase
        .from("label_templates")
        .select("*")
        .eq("id", templateId)
        .eq("org_id", orgId)
        .single();
      
      if (!error && data) {
        template = data;
      }
    }

    // Build ZPL - use printer's DPI setting (default to 300 for modern Zebras)
    const printerDpi = printer.dpi || 300;
    const labelColumns = printer.label_columns || 1;

    const labelInput = {
      batchNumber,
      variety,
      family,
      quantity,
      size,
      location,
      payload: payload ?? `ht:batch:${batchNumber}`,
    };

    let zpl: string;
    if (labelColumns > 1) {
      // Multi-column printing (e.g., 2-across labels)
      zpl = buildZplRow(labelInput, {
        dpi: printerDpi,
        label_columns: labelColumns,
        label_width_mm: printer.label_width_mm || 50,
        label_gap_mm: printer.label_gap_mm || 3,
      }, copies);
    } else if (template) {
      zpl = buildZplWithTemplate(labelInput, { ...template, dpi: printerDpi }, copies);
    } else {
      zpl = buildZpl(labelInput, copies, printerDpi);
    }

    const result = await sendToPrinter(printer, zpl, {
      jobType: "batch",
      orgId,
      userId: user.id,
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
    logger.api.error("Batch label print failed", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
