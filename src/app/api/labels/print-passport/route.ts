export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  buildPassportLabelZpl,
  buildPassportLabelLargeZpl,
  buildCombinedBatchPassportZpl,
  type PassportLabelInput
} from "@/server/labels/build-passport-label";
import { sendToPrinter } from "@/server/labels/send-to-printer";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "@/server/org/getActiveOrg";
import { z } from "zod";

const PassportPrintSchema = z.object({
  batchId: z.string().uuid(),
  format: z.enum(["compact", "large", "combined"]).default("compact"),
  copies: z.number().int().min(1).max(100).default(1),
  printerId: z.string().optional(),
});

/**
 * POST /api/labels/print-passport
 * Print EU Plant Passport labels for a batch
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const body = await request.json();
    const { batchId, format, copies, printerId } = PassportPrintSchema.parse(body);

    // Fetch batch with passport data
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select(`
        id,
        batch_number,
        quantity,
        plant_variety_id,
        plant_size_id,
        location_id,
        supplier_id,
        plant_varieties (
          name,
          family
        ),
        plant_sizes (
          name
        ),
        locations (
          name
        ),
        suppliers (
          producer_code,
          country_code
        )
      `)
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Get organization's default producer code if supplier doesn't have one
    const { data: org } = await supabase
      .from("organizations")
      .select("producer_code, country_code")
      .eq("id", orgId)
      .single();

    // Build passport data
    const passportInput: PassportLabelInput = {
      aFamily: (batch.plant_varieties as any)?.family || "Unknown Family",
      bProducerCode: (batch.suppliers as any)?.producer_code
        || org?.producer_code
        || process.env.DEFAULT_PRODUCER_CODE
        || "UNKNOWN",
      cBatchNumber: batch.batch_number || batch.id,
      dCountryCode: (batch.suppliers as any)?.country_code
        || org?.country_code
        || process.env.DEFAULT_COUNTRY_CODE
        || "IE",
      variety: (batch.plant_varieties as any)?.name,
    };

    // Generate ZPL based on format
    let zpl: string;

    if (format === "large") {
      zpl = buildPassportLabelLargeZpl(passportInput, { copies });
    } else if (format === "combined") {
      const batchInfo = {
        batchNumber: batch.batch_number || batch.id,
        variety: (batch.plant_varieties as any)?.name || "Unknown Variety",
        family: (batch.plant_varieties as any)?.family || "Unknown Family",
        quantity: batch.quantity || 0,
        size: (batch.plant_sizes as any)?.name || "Unknown Size",
        location: (batch.locations as any)?.name,
      };
      zpl = buildCombinedBatchPassportZpl(batchInfo, passportInput, { copies });
    } else {
      zpl = buildPassportLabelZpl(passportInput, { copies });
    }

    // Send to printer if printerId provided
    let jobId: string | undefined;
    if (printerId) {
      // Get printer configuration
      const { data: printer, error: printerError } = await supabase
        .from("printers")
        .select("*")
        .eq("id", printerId)
        .eq("org_id", orgId)
        .single();

      if (printerError || !printer) {
        return NextResponse.json(
          { error: "Printer not found" },
          { status: 404 }
        );
      }

      // Get current user for tracking
      const { data: { user } } = await supabase.auth.getUser();

      const result = await sendToPrinter(printer, zpl, {
        jobType: "passport",
        orgId,
        userId: user?.id,
        copies,
      });

      if (!result.success) {
        return NextResponse.json(
          { ok: false, error: result.error || "Print failed" },
          { status: 400 }
        );
      }
      jobId = result.jobId;
    }

    return NextResponse.json({
      ok: true,
      zpl,
      passport: passportInput,
      format,
      copies,
      jobId,
    });
  } catch (error: any) {
    console.error("[print-passport] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate passport label" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/labels/print-passport?batchId=...&format=...
 * Preview passport label (returns ZPL without printing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const format = (searchParams.get("format") || "compact") as "compact" | "large" | "combined";

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId is required" },
        { status: 400 }
      );
    }

    const { supabase, orgId } = await getUserAndOrg();

    // Fetch batch with passport data
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select(`
        id,
        batch_number,
        quantity,
        plant_variety_id,
        plant_size_id,
        location_id,
        supplier_id,
        plant_varieties (
          name,
          family
        ),
        plant_sizes (
          name
        ),
        locations (
          name
        ),
        suppliers (
          producer_code,
          country_code
        )
      `)
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Get organization's default producer code
    const { data: org } = await supabase
      .from("organizations")
      .select("producer_code, country_code")
      .eq("id", orgId)
      .single();

    // Build passport data
    const passportInput: PassportLabelInput = {
      aFamily: (batch.plant_varieties as any)?.family || "Unknown Family",
      bProducerCode: (batch.suppliers as any)?.producer_code
        || org?.producer_code
        || process.env.DEFAULT_PRODUCER_CODE
        || "UNKNOWN",
      cBatchNumber: batch.batch_number || batch.id,
      dCountryCode: (batch.suppliers as any)?.country_code
        || org?.country_code
        || process.env.DEFAULT_COUNTRY_CODE
        || "IE",
      variety: (batch.plant_varieties as any)?.name,
    };

    // Generate ZPL based on format
    let zpl: string;

    if (format === "large") {
      zpl = buildPassportLabelLargeZpl(passportInput);
    } else if (format === "combined") {
      const batchInfo = {
        batchNumber: batch.batch_number || batch.id,
        variety: (batch.plant_varieties as any)?.name || "Unknown Variety",
        family: (batch.plant_varieties as any)?.family || "Unknown Family",
        quantity: batch.quantity || 0,
        size: (batch.plant_sizes as any)?.name || "Unknown Size",
        location: (batch.locations as any)?.name,
      };
      zpl = buildCombinedBatchPassportZpl(batchInfo, passportInput);
    } else {
      zpl = buildPassportLabelZpl(passportInput);
    }

    return NextResponse.json({
      ok: true,
      zpl,
      passport: passportInput,
      format,
    });
  } catch (error: any) {
    console.error("[print-passport] Preview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate passport label" },
      { status: 500 }
    );
  }
}
