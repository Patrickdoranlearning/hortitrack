import { NextRequest, NextResponse } from 'next/server';
import { getUserAndOrg } from '@/server/auth/org';
import { generateId } from '@/server/utils/ids';
import { logger, getErrorMessage } from '@/server/utils/logger';

/**
 * POST /api/dispatch/assign-picker
 * Assign a picker to an order's pick list
 * Creates pick list AND pick items if they don't exist
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();
    const userId = user.id;

    const body = await req.json();
    const { orderId, pickerId } = body;

    // Use calling user's ID if no explicit picker specified
    const assignedPickerId = pickerId || userId;

    logger.picking.info('Assign picker request', { orderId, pickerId: assignedPickerId, orgId, userId });

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Verify the order exists and belongs to this org
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, org_id, status')
      .eq('id', orderId)
      .eq('org_id', orgId)
      .single();

    if (orderError || !order) {
      logger.picking.warn('Order not found for picker assignment', { orderId, error: orderError?.message });
      return NextResponse.json(
        { ok: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Check if pick list already exists for this order
    const { data: existing, error: checkError } = await supabase
      .from('pick_lists')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (checkError) {
      logger.picking.error('Error checking existing pick list', checkError, { orderId });
      return NextResponse.json(
        { ok: false, error: 'Failed to check existing pick list: ' + checkError.message },
        { status: 500 }
      );
    }

    let pickListId: string;
    let wasCreated: boolean;

    if (existing) {
      // Update existing pick list - assign to picker
      const { error: updateError } = await supabase
        .from('pick_lists')
        .update({
          assigned_user_id: assignedPickerId,
          updated_at: now,
        })
        .eq('id', existing.id);

      if (updateError) {
        logger.picking.error('Error updating pick list', updateError, { pickListId: existing.id });
        return NextResponse.json(
          { ok: false, error: 'Failed to update pick list: ' + updateError.message },
          { status: 500 }
        );
      }

      pickListId = existing.id;
      wasCreated = false;

      logger.picking.info('Pick list updated', { pickListId: existing.id, pickerId: assignedPickerId });
    } else {
      // Create new pick list WITH pick items
      const newPickListId = generateId();
      const { error: insertError } = await supabase
        .from('pick_lists')
        .insert({
          id: newPickListId,
          org_id: orgId,
          order_id: orderId,
          assigned_user_id: assignedPickerId,
          status: 'pending',
          sequence: 1,
          is_partial: false,
          created_at: now,
          updated_at: now,
        });

      if (insertError) {
        logger.picking.error('Error creating pick list', insertError, { orderId });
        return NextResponse.json(
          { ok: false, error: 'Failed to create pick list: ' + insertError.message },
          { status: 500 }
        );
      }

      pickListId = newPickListId;
      wasCreated = true;

      // Fetch order items to create pick items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          skus(plant_variety_id, size_id),
          product_id
        `)
        .eq('order_id', orderId);

      if (itemsError) {
        logger.picking.warn('Error fetching order items', { orderId, error: itemsError.message });
        // Don't fail the whole operation - pick list exists, items can be added later
      } else if (orderItems && orderItems.length > 0) {
        // Get allocations for these order items to set original_batch_id
        const orderItemIds = orderItems.map((oi) => oi.id);
        const { data: allocations } = await supabase
          .from('batch_allocations')
          .select('order_item_id, batch_id, quantity')
          .in('order_item_id', orderItemIds)
          .eq('status', 'allocated');

        // Build allocation map (order_item_id -> batch_id)
        const allocationMap = new Map<string, string>();
        for (const alloc of allocations || []) {
          if (!allocationMap.has(alloc.order_item_id)) {
            allocationMap.set(alloc.order_item_id, alloc.batch_id);
          }
        }

        // Get batch locations for hints
        const batchIds = [...new Set(allocations?.map(a => a.batch_id) || [])];
        const batchLocationMap = new Map<string, string>();
        if (batchIds.length > 0) {
          const { data: batches } = await supabase
            .from('batches')
            .select('id, nursery_locations(name)')
            .in('id', batchIds);

          for (const b of batches || []) {
            const locationName = (b.nursery_locations as { name?: string })?.name || '';
            batchLocationMap.set(b.id, locationName);
          }
        }

        // Create pick items
        const pickItems = orderItems.map((oi) => {
          const batchId = allocationMap.get(oi.id);
          return {
            id: generateId(),
            pick_list_id: pickListId,
            order_item_id: oi.id,
            target_qty: oi.quantity,
            picked_qty: 0,
            status: 'pending',
            original_batch_id: batchId || null,
            location_hint: batchId ? batchLocationMap.get(batchId) || null : null,
            created_at: now,
            updated_at: now,
          };
        });

        const { error: pickItemsError } = await supabase
          .from('pick_items')
          .insert(pickItems);

        if (pickItemsError) {
          logger.picking.error('Error creating pick items', pickItemsError, { pickListId });
          // Don't fail - pick list exists, we can try again
        } else {
          logger.picking.info('Pick items created', { pickListId, count: pickItems.length });
        }
      }

      logger.picking.info('Pick list created', { pickListId, orderId, pickerId: assignedPickerId });
    }

    // Update order status to 'picking' if it's 'confirmed'
    if (order.status === 'confirmed') {
      const { error: statusError } = await supabase
        .from('orders')
        .update({ status: 'picking', updated_at: now })
        .eq('id', orderId);

      if (statusError) {
        logger.picking.warn('Failed to update order status to picking', { orderId, error: statusError.message });
      }
    }

    logger.picking.info('Picker assignment complete', { pickListId, wasCreated, pickerId: assignedPickerId });

    return NextResponse.json({
      ok: true,
      pickListId,
      pickerId: assignedPickerId,
      created: wasCreated,
    });
  } catch (error) {
    logger.picking.error('Error in assign-picker route', error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
