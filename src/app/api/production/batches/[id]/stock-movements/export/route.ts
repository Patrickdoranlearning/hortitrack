import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { logError } from '@/lib/log';

/**
 * GET /api/production/batches/[id]/stock-movements/export
 * Exports stock movement history as CSV
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const { orgId, supabase } = await getUserAndOrg();

    // Get batch info
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('batch_number, quantity')
      .eq('id', batchId)
      .eq('org_id', orgId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Get all stock movement events
    const stockEventTypes = [
      'SEEDING',
      'TRANSPLANT',
      'TRANSPLANT_SOURCE',
      'TRANSPLANT_TARGET',
      'ADJUSTMENT',
      'LOSS',
      'DUMP',
      'DISPATCH',
      'ORDER_ALLOCATED',
      'ORDER_DEALLOCATED',
      'STOCK_RESERVED',
      'STOCK_RELEASED',
    ];

    const { data: events, error: eventsError } = await supabase
      .from('batch_events')
      .select('id, type, at, by_user_id, payload')
      .eq('batch_id', batchId)
      .eq('org_id', orgId)
      .in('type', stockEventTypes)
      .order('at', { ascending: true });

    if (eventsError) {
      logError('Failed to fetch stock movements for export', { error: eventsError.message });
      return NextResponse.json(
        { error: 'Failed to fetch stock movements' },
        { status: 500 }
      );
    }

    // Get user names for the events
    const userIds = [...new Set(events?.map(e => e.by_user_id).filter(Boolean) || [])];
    let userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profiles) {
        userMap = profiles.reduce((acc, p) => {
          acc[p.id] = p.full_name || p.email || 'Unknown';
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Build CSV
    const headers = [
      'Date',
      'Time',
      'Event Type',
      'Quantity Change',
      'Previous Qty',
      'New Qty',
      'Reason',
      'Notes',
      'User',
    ];

    const rows = (events || []).map(event => {
      const payload = event.payload as Record<string, unknown> || {};
      const eventDate = new Date(event.at);

      // Extract quantity change info from various payload formats
      const qtyChange = payload.qty_change ?? payload.units ?? payload.quantity ?? '';
      const prevQty = payload.previous_quantity ?? '';
      const newQty = payload.new_quantity ?? '';
      const reason = payload.reason_label ?? payload.reason ?? '';
      const notes = payload.notes ?? '';
      const userName = event.by_user_id ? (userMap[event.by_user_id] || 'Unknown') : '';

      return [
        eventDate.toLocaleDateString('en-IE'),
        eventDate.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }),
        formatEventType(event.type),
        String(qtyChange),
        String(prevQty),
        String(newQty),
        String(reason),
        String(notes).replace(/"/g, '""'), // Escape quotes for CSV
        userName,
      ];
    });

    // Build CSV content
    const csvContent = [
      `# Stock Movement Report - Batch ${batch.batch_number}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Current Stock: ${batch.quantity}`,
      '',
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Return CSV file
    const filename = `stock-movements-${batch.batch_number}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logError('Error exporting stock movements', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to export stock movements' },
      { status: 500 }
    );
  }
}

function formatEventType(type: string): string {
  const typeLabels: Record<string, string> = {
    SEEDING: 'Initial Seeding',
    TRANSPLANT: 'Transplant',
    TRANSPLANT_SOURCE: 'Transplant (Source)',
    TRANSPLANT_TARGET: 'Transplant (Target)',
    ADJUSTMENT: 'Stock Adjustment',
    LOSS: 'Loss Recorded',
    DUMP: 'Stock Dump',
    DISPATCH: 'Dispatched',
    ORDER_ALLOCATED: 'Order Allocated',
    ORDER_DEALLOCATED: 'Order Deallocated',
    STOCK_RESERVED: 'Stock Reserved',
    STOCK_RELEASED: 'Stock Released',
  };
  return typeLabels[type] || type;
}
