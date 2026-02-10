import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import { getUserAndOrg } from '@/server/auth/org';
import { logger } from '@/server/utils/logger';

interface RouteContext {
  params: Promise<{ batchId: string; orderId: string }>;
}

// PATCH /api/bulk-picking/[batchId]/orders/[orderId] - Update order packing status
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { batchId, orderId } = await context.params;
    const { orgId, userId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body = await req.json();
    
    const { action, trolleyInfo, qcChecklist, qcNotes } = body;
    
    // Verify batch belongs to org
    const { data: batch } = await supabase
      .from('bulk_pick_batches')
      .select('id')
      .eq('id', batchId)
      .eq('org_id', orgId)
      .single();
    
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    switch (action) {
      case 'start_packing': {
        const { error } = await supabase
          .from('bulk_pick_batch_orders')
          .update({
            packing_status: 'in_progress',
          })
          .eq('bulk_batch_id', batchId)
          .eq('order_id', orderId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'complete_packing': {
        // Update batch order status
        const { error: batchOrderError } = await supabase
          .from('bulk_pick_batch_orders')
          .update({
            packing_status: 'packed',
            packed_at: new Date().toISOString(),
            packed_by: userId,
          })
          .eq('bulk_batch_id', batchId)
          .eq('order_id', orderId);
        
        if (batchOrderError) {
          return NextResponse.json({ error: batchOrderError.message }, { status: 500 });
        }
        
        // Update order packing record
        if (trolleyInfo) {
          await supabase
            .from('order_packing')
            .upsert({
              order_id: orderId,
              org_id: orgId,
              status: 'completed',
              trolleys_used: trolleyInfo.count || 0,
              trolley_type: trolleyInfo.trolleyType || 'tag6',
              shelves: trolleyInfo.shelves || 0,
              trolley_numbers: trolleyInfo.trolleyNumbers || [],
              qc_checklist: qcChecklist,
              qc_notes: qcNotes,
              packing_completed_at: new Date().toISOString(),
              verified_by: userId,
              verified_at: new Date().toISOString(),
            }, {
              onConflict: 'order_id',
            });
        }
        
        // Update order status
        await supabase
          .from('orders')
          .update({ status: 'ready_for_dispatch' })
          .eq('id', orderId);
        
        // Check if all orders in batch are packed
        const { data: remainingOrders } = await supabase
          .from('bulk_pick_batch_orders')
          .select('id')
          .eq('bulk_batch_id', batchId)
          .neq('packing_status', 'packed');
        
        if (!remainingOrders || remainingOrders.length === 0) {
          // All orders packed, complete the batch
          await supabase
            .from('bulk_pick_batches')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completed_by: userId,
            })
            .eq('id', batchId);
        }
        
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    logger.picking.error("Error updating order packing", error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

