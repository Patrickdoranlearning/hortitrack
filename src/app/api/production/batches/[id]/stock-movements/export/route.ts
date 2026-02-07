import { NextRequest, NextResponse } from 'next/server';
import { getUserAndOrg } from '@/server/auth/org';
import { getStockMovementsWithDetails } from '@/server/batches/stock-movements';
import { logError } from '@/lib/log';
import { getSupabaseAdmin } from '@/server/db/supabase';

/**
 * GET /api/production/batches/[id]/stock-movements/export
 * Exports stock movement history as CSV — reuses the same data as the Stock tab
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const { orgId } = await getUserAndOrg();

    const supabase = getSupabaseAdmin();

    // Get batch info for filename and header
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

    // Reuse the same stock movements that power the Stock tab
    const { movements, summary } = await getStockMovementsWithDetails(batchId);

    const headers = [
      'Date',
      'Time',
      'Type',
      'In',
      'Out',
      'Balance',
      'Description',
      'Details',
    ];

    const rows = movements.map(m => {
      const date = new Date(m.at);
      const isAllocation = m.type === 'allocated';
      const inQty = !isAllocation && m.quantity > 0 ? m.quantity : '';
      const outQty = !isAllocation && m.quantity < 0 ? Math.abs(m.quantity) : '';
      const allocQty = isAllocation ? `(${Math.abs(m.quantity)})` : '';
      const balance = m.runningBalance != null ? m.runningBalance : '';

      return [
        date.toLocaleDateString('en-IE'),
        date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }),
        m.type,
        String(inQty),
        allocQty || String(outQty),
        String(balance),
        (m.title ?? '').replace(/"/g, '""'),
        (m.details ?? '').replace(/"/g, '""'),
      ];
    });

    const csvContent = [
      `# Stock Movement Report - Batch ${batch.batch_number}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Current Stock: ${batch.quantity}`,
      `# Total In: ${summary.totalIn} | Total Out: ${summary.totalOut} | Reserved: ${summary.allocated}`,
      '',
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

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
