export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { buildLocationZpl } from '@/server/labels/build-location-label';
import { getSupabaseServerApp } from '@/server/db/supabase';
import { resolveActiveOrgId } from '@/server/org/getActiveOrg';
import { sendToPrinter } from '@/server/labels/send-to-printer';
import { logger } from '@/server/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      locationId,
      locationName,
      nurserySite,
      type,
      siteId,
      batchCount,
      totalQuantity,
      batches = [],
      payload,
      printerId,
      copies = 1,
    } = body;

    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json({ ok: false, error: 'No active organization' }, { status: 401 });
    }

    // Get printer configuration
    let printer;
    if (printerId) {
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .eq('id', printerId)
        .eq('org_id', orgId)
        .single();

      if (error || !data) {
        return NextResponse.json({ ok: false, error: 'Printer not found' }, { status: 404 });
      }
      printer = data;
    } else {
      // Get default printer
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        // Fallback to env vars if no default printer configured
        const envHost = process.env.PRINTER_HOST;
        if (!envHost) {
          return NextResponse.json(
            {
              ok: false,
              error: 'No printer configured. Please add a printer in settings.',
            },
            { status: 400 }
          );
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

    // Build ZPL for location label - use printer's DPI setting (default to 300 for modern Zebras)
    const printerDpi = printer.dpi || 300;

    const labelInput = {
      locationId,
      locationName,
      nurserySite,
      type,
      siteId,
      batchCount,
      totalQuantity,
      batches: (batches || []).map((b: any) => ({
        batchNumber: b.batchNumber,
        variety: b.variety,
        quantity: b.quantity,
        pottedDate: b.pottedDate,
      })),
      payload: payload ?? `ht:loc:${locationId}`,
    };

    const zpl = buildLocationZpl(labelInput, copies, printerDpi);

    // Get current user for tracking
    const { data: { user } } = await supabase.auth.getUser();

    // Send to printer (handles both network and agent-connected printers)
    const result = await sendToPrinter(printer, zpl, {
      jobType: 'location',
      orgId,
      userId: user?.id,
      copies,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Print failed',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, copies, jobId: result.jobId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Print failed';
    logger.api.error("Location label print failed", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}







