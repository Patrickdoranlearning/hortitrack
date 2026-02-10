import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import { getUserAndOrg } from '@/server/auth/org';
import { nanoid } from 'nanoid';
import { logger } from '@/server/utils/logger';

// GET /api/bulk-picking - List bulk pick batches
export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    
    let query = supabase
      .from('bulk_pick_batches')
      .select(`
        *,
        bulk_pick_batch_orders(
          id,
          order_id,
          packing_status,
          order:orders(
            order_number,
            customer:customers(name)
          )
        ),
        bulk_pick_items(count)
      `)
      .eq('org_id', orgId)
      .order('batch_date', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date) {
      query = query.eq('batch_date', date);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.picking.error("Error fetching bulk pick batches", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Transform data
    const batches = (data || []).map((batch: any) => ({
      id: batch.id,
      batchNumber: batch.batch_number,
      batchDate: batch.batch_date,
      status: batch.status,
      startedAt: batch.started_at,
      completedAt: batch.completed_at,
      notes: batch.notes,
      orderCount: batch.bulk_pick_batch_orders?.length || 0,
      itemCount: batch.bulk_pick_items?.[0]?.count || 0,
      orders: (batch.bulk_pick_batch_orders || []).map((bo: any) => ({
        id: bo.order_id,
        orderNumber: bo.order?.order_number,
        customerName: bo.order?.customer?.name,
        packingStatus: bo.packing_status,
      })),
    }));
    
    return NextResponse.json({ batches });
  } catch (error: any) {
    logger.picking.error("Bulk picking GET failed", error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/bulk-picking - Create a new bulk pick batch
export async function POST(req: NextRequest) {
  try {
    const { orgId, userId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body = await req.json();
    
    const { date, orderIds, notes } = body;
    
    if (!date || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Date and at least one order ID are required' },
        { status: 400 }
      );
    }
    
    // Generate batch number
    const batchNumber = `BP-${date.replace(/-/g, '')}-${nanoid(4).toUpperCase()}`;
    
    // Create the bulk pick batch
    const { data: batch, error: batchError } = await supabase
      .from('bulk_pick_batches')
      .insert({
        org_id: orgId,
        batch_number: batchNumber,
        batch_date: date,
        notes,
      })
      .select()
      .single();
    
    if (batchError) {
      logger.picking.error("Error creating bulk pick batch", batchError);
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }
    
    // Get pick lists for the orders
    const { data: pickLists } = await supabase
      .from('pick_lists')
      .select('id, order_id')
      .in('order_id', orderIds)
      .eq('org_id', orgId);
    
    const pickListMap = new Map(
      (pickLists || []).map((pl: any) => [pl.order_id, pl.id])
    );
    
    // Add orders to the batch
    const batchOrders = orderIds.map((orderId: string) => ({
      bulk_batch_id: batch.id,
      order_id: orderId,
      pick_list_id: pickListMap.get(orderId) || null,
    }));
    
    const { error: ordersError } = await supabase
      .from('bulk_pick_batch_orders')
      .insert(batchOrders);
    
    if (ordersError) {
      logger.picking.error("Error adding orders to bulk pick batch", ordersError);
      // Clean up the batch if order insertion fails
      await supabase.from('bulk_pick_batches').delete().eq('id', batch.id);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }
    
    // Aggregate items from pick lists for bulk picking
    const { data: pickItems } = await supabase
      .from('pick_items')
      .select(`
        sku_id:order_items(sku_id),
        target_qty,
        order_item:order_items(
          sku:skus(
            id,
            sku_code,
            plant_variety:plant_varieties(name),
            plant_size:plant_sizes(name)
          )
        )
      `)
      .in('pick_list_id', Array.from(pickListMap.values()));
    
    // Aggregate by SKU
    const skuTotals = new Map<string, { skuId: string; totalQty: number; locationHint?: string }>();
    
    for (const item of pickItems || []) {
      const skuId = item.sku_id?.sku_id || item.order_item?.sku?.id;
      if (!skuId) continue;
      
      const existing = skuTotals.get(skuId);
      if (existing) {
        existing.totalQty += item.target_qty;
      } else {
        skuTotals.set(skuId, {
          skuId,
          totalQty: item.target_qty,
        });
      }
    }
    
    // Insert bulk pick items
    if (skuTotals.size > 0) {
      const bulkItems = Array.from(skuTotals.values()).map((sku) => ({
        bulk_batch_id: batch.id,
        sku_id: sku.skuId,
        total_qty: sku.totalQty,
        location_hint: sku.locationHint,
      }));
      
      const { error: itemsError } = await supabase
        .from('bulk_pick_items')
        .insert(bulkItems);
      
      if (itemsError) {
        logger.picking.error("Error creating bulk pick items", itemsError);
        // Non-fatal, batch is still created
      }
    }
    
    return NextResponse.json({
      batch: {
        id: batch.id,
        batchNumber: batch.batch_number,
        batchDate: batch.batch_date,
        status: batch.status,
        orderCount: orderIds.length,
      },
    });
  } catch (error: any) {
    logger.picking.error("Bulk picking POST failed", error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

