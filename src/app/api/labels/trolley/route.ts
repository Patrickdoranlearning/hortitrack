export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  buildTrolleyLabelZpl,
  generateTrolleyLabelCode,
  type TrolleyLabelInput,
} from '@/server/labels/build-trolley-label';
import { getSupabaseServerApp } from '@/server/db/supabase';
import { resolveActiveOrgId } from '@/server/org/getActiveOrg';
import { sendToPrinter } from '@/server/labels/send-to-printer';
import { logger } from '@/server/utils/logger';

/**
 * POST /api/labels/trolley
 * Generate and print trolley labels with datamatrix for scan-to-pick workflow
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId,
      pickListId,
      customerName,
      orderNumber,
      trolleyNumber,
      deliveryDate,
      itemCount,
      notes,
      printerId,
      copies = 1,
    } = body;

    // Validate required fields
    if (!orderId || !customerName || !orderNumber) {
      return NextResponse.json(
        {
          ok: false,
          error: 'orderId, customerName, and orderNumber are required',
        },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'No active organization' },
        { status: 401 }
      );
    }

    // Generate unique label code
    const labelCode = generateTrolleyLabelCode(orgId, orderId);

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
        return NextResponse.json(
          { ok: false, error: 'Printer not found' },
          { status: 404 }
        );
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

    // Build trolley label input
    const labelInput: TrolleyLabelInput = {
      labelCode,
      customerName,
      orderNumber,
      trolleyNumber,
      deliveryDate,
      itemCount,
      notes,
    };

    // Build ZPL
    const zpl = buildTrolleyLabelZpl(labelInput, copies);

    // Save trolley label record to database
    const { data: trolleyLabel, error: insertError } = await supabase
      .from('trolley_labels')
      .insert({
        org_id: orgId,
        order_id: orderId,
        pick_list_id: pickListId,
        label_code: labelCode,
        trolley_number: trolleyNumber,
        customer_name: customerName,
        order_number: orderNumber,
        printed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logger.api.warn("Failed to save trolley label record", { error: insertError.message });
      // Continue with printing even if DB save fails
    }

    // Get current user for tracking
    const { data: { user } } = await supabase.auth.getUser();

    // Send to printer (handles both network and agent-connected printers)
    const result = await sendToPrinter(printer, zpl, {
      jobType: 'trolley',
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

    return NextResponse.json({
      ok: true,
      copies,
      labelCode,
      labelId: trolleyLabel?.id,
      jobId: result.jobId,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Print failed';
    logger.api.error("Trolley label print failed", e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/labels/trolley/scan?code=HT:xxx:xxx:xxx
 * Decode a scanned trolley label and return order info
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { ok: false, error: 'code parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerApp();
    const orgId = await resolveActiveOrgId();

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'No active organization' },
        { status: 401 }
      );
    }

    // Find the trolley label by code
    const { data: trolleyLabel, error } = await supabase
      .from('trolley_labels')
      .select(`
        *,
        orders:order_id (
          id,
          order_number,
          status,
          requested_delivery_date,
          customers:customer_id (
            id,
            name
          )
        ),
        pick_lists:pick_list_id (
          id,
          status,
          assigned_user_id
        )
      `)
      .eq('label_code', code)
      .eq('org_id', orgId)
      .single();

    if (error || !trolleyLabel) {
      return NextResponse.json(
        { ok: false, error: 'Label not found' },
        { status: 404 }
      );
    }

    // Mark the label as scanned
    await supabase
      .from('trolley_labels')
      .update({ scanned_at: new Date().toISOString() })
      .eq('id', trolleyLabel.id);

    return NextResponse.json({
      ok: true,
      label: trolleyLabel,
      order: trolleyLabel.orders,
      pickList: trolleyLabel.pick_lists,
    });
  } catch (e: any) {
    logger.api.error("Trolley label scan failed", e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Scan failed' },
      { status: 500 }
    );
  }
}

