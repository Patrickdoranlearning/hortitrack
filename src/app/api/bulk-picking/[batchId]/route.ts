import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import { getUserAndOrg } from '@/server/auth/org';

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

// GET /api/bulk-picking/[batchId] - Get bulk pick batch details
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    
    // Fetch batch with orders and items
    const { data: batch, error: batchError } = await supabase
      .from('bulk_pick_batches')
      .select(`
        *,
        bulk_pick_batch_orders(
          id,
          order_id,
          pick_list_id,
          packing_status,
          packed_at,
          order:orders(
            id,
            order_number,
            requested_delivery_date,
            customer:customers(name, phone)
          )
        ),
        bulk_pick_items(
          id,
          sku_id,
          total_qty,
          picked_qty,
          status,
          picked_batch_id,
          substitute_batch_id,
          substitution_reason,
          location_hint,
          sku:skus(
            id,
            sku_code,
            plant_variety:plant_varieties(name),
            plant_size:plant_sizes(name)
          )
        )
      `)
      .eq('id', batchId)
      .eq('org_id', orgId)
      .single();
    
    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    // Transform data
    const result = {
      id: batch.id,
      batchNumber: batch.batch_number,
      batchDate: batch.batch_date,
      status: batch.status,
      startedAt: batch.started_at,
      startedBy: batch.started_by,
      completedAt: batch.completed_at,
      completedBy: batch.completed_by,
      notes: batch.notes,
      orders: (batch.bulk_pick_batch_orders || []).map((bo: any) => ({
        id: bo.id,
        orderId: bo.order_id,
        pickListId: bo.pick_list_id,
        packingStatus: bo.packing_status,
        packedAt: bo.packed_at,
        orderNumber: bo.order?.order_number,
        customerName: bo.order?.customer?.name,
        requestedDeliveryDate: bo.order?.requested_delivery_date,
      })),
      items: (batch.bulk_pick_items || []).map((item: any) => ({
        id: item.id,
        skuId: item.sku_id,
        skuCode: item.sku?.sku_code,
        productName: item.sku?.plant_variety?.name,
        size: item.sku?.plant_size?.name,
        totalQty: item.total_qty,
        pickedQty: item.picked_qty,
        status: item.status,
        pickedBatchId: item.picked_batch_id,
        substituteBatchId: item.substitute_batch_id,
        substitutionReason: item.substitution_reason,
        locationHint: item.location_hint,
      })),
    };
    
    return NextResponse.json({ batch: result });
  } catch (error: any) {
    console.error('Error fetching bulk pick batch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/bulk-picking/[batchId] - Update bulk pick batch
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    const { orgId, userId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body = await req.json();
    
    const { action, itemId, pickedQty, pickedBatchId, substituteBatchId, substitutionReason, notes } = body;
    
    // Handle different actions
    switch (action) {
      case 'start': {
        const { error } = await supabase
          .from('bulk_pick_batches')
          .update({
            status: 'in_progress',
            started_at: new Date().toISOString(),
            started_by: userId,
          })
          .eq('id', batchId)
          .eq('org_id', orgId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'complete_picking': {
        const { error } = await supabase
          .from('bulk_pick_batches')
          .update({
            status: 'picked',
          })
          .eq('id', batchId)
          .eq('org_id', orgId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'start_packing': {
        const { error } = await supabase
          .from('bulk_pick_batches')
          .update({
            status: 'packing',
          })
          .eq('id', batchId)
          .eq('org_id', orgId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'complete': {
        const { error } = await supabase
          .from('bulk_pick_batches')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: userId,
          })
          .eq('id', batchId)
          .eq('org_id', orgId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'pick_item': {
        if (!itemId) {
          return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }
        
        const updates: any = {
          picked_qty: pickedQty,
          status: 'picked',
        };
        
        if (pickedBatchId) {
          updates.picked_batch_id = pickedBatchId;
        }
        
        const { error } = await supabase
          .from('bulk_pick_items')
          .update(updates)
          .eq('id', itemId)
          .eq('bulk_batch_id', batchId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'substitute_item': {
        if (!itemId || !substituteBatchId) {
          return NextResponse.json(
            { error: 'Item ID and substitute batch ID required' },
            { status: 400 }
          );
        }
        
        const { error } = await supabase
          .from('bulk_pick_items')
          .update({
            picked_qty: pickedQty,
            status: 'substituted',
            substitute_batch_id: substituteBatchId,
            substitution_reason: substitutionReason,
          })
          .eq('id', itemId)
          .eq('bulk_batch_id', batchId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'short_item': {
        if (!itemId) {
          return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }
        
        const { error } = await supabase
          .from('bulk_pick_items')
          .update({
            picked_qty: pickedQty || 0,
            status: 'short',
          })
          .eq('id', itemId)
          .eq('bulk_batch_id', batchId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      case 'update_notes': {
        const { error } = await supabase
          .from('bulk_pick_batches')
          .update({ notes })
          .eq('id', batchId)
          .eq('org_id', orgId);
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error updating bulk pick batch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/bulk-picking/[batchId] - Cancel/delete bulk pick batch
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { batchId } = await context.params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    
    // Check if batch can be deleted (only pending batches)
    const { data: batch } = await supabase
      .from('bulk_pick_batches')
      .select('status')
      .eq('id', batchId)
      .eq('org_id', orgId)
      .single();
    
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    if (batch.status !== 'pending') {
      // Cancel instead of delete for non-pending batches
      const { error } = await supabase
        .from('bulk_pick_batches')
        .update({ status: 'cancelled' })
        .eq('id', batchId)
        .eq('org_id', orgId);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, action: 'cancelled' });
    }
    
    // Delete pending batch
    const { error } = await supabase
      .from('bulk_pick_batches')
      .delete()
      .eq('id', batchId)
      .eq('org_id', orgId);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, action: 'deleted' });
  } catch (error: any) {
    console.error('Error deleting bulk pick batch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

