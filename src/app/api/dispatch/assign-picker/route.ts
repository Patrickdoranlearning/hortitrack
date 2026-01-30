import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { generateId } from '@/server/utils/ids';
import { logger, getErrorMessage } from '@/server/utils/logger';

/**
 * POST /api/dispatch/assign-picker
 * Assign a picker to an order's pick list
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const supabase = await createClient();

    const body = await req.json();
    const { orderId, pickerId } = body;

    logger.picking.info('Assign picker request', { orderId, pickerId, orgId, userId });

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Verify the order exists and belongs to this org
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, org_id')
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
    // Use explicit check + update/insert to avoid FK constraint issues with upsert
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
      // Update existing pick list - just change the assigned_user_id
      const { error: updateError } = await supabase
        .from('pick_lists')
        .update({
          assigned_user_id: pickerId || null,
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

      // Verify the update was successful by re-fetching
      logger.picking.info('Pick list updated', { pickListId: existing.id, pickerId });
    } else {
      // Create new pick list
      const newId = generateId();
      const { data: inserted, error: insertError } = await supabase
        .from('pick_lists')
        .insert({
          id: newId,
          org_id: orgId,
          order_id: orderId,
          assigned_user_id: pickerId || null,
          status: 'pending',
          sequence: 1,
          is_partial: false,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (insertError) {
        logger.picking.error('Error creating pick list', insertError, { orderId });
        return NextResponse.json(
          { ok: false, error: 'Failed to create pick list: ' + insertError.message },
          { status: 500 }
        );
      }

      pickListId = inserted.id;
      wasCreated = true;

      logger.picking.info('Pick list created', { pickListId: inserted.id, orderId, pickerId });
    }

    logger.picking.info('Picker assignment complete', { pickListId, wasCreated, pickerId });

    return NextResponse.json({
      ok: true,
      pickListId,
      pickerId,
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
