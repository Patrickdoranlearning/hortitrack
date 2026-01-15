import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { generateId } from '@/server/utils/ids';

/**
 * POST /api/dispatch/assign-load
 * Assign an order to a delivery run (load)
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const supabase = await createClient();

    const body = await req.json();
    const { orderId, loadId } = body;

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Verify the order exists and belongs to this org
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, org_id, trolleys_estimated')
      .eq('id', orderId)
      .eq('org_id', orgId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { ok: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if delivery item already exists for this order
    const { data: existingItem } = await supabase
      .from('delivery_items')
      .select('id, delivery_run_id')
      .eq('order_id', orderId)
      .single();

    // If loadId is null/empty, we're unassigning the order from any load
    if (!loadId) {
      if (existingItem) {
        // Delete the existing delivery item
        const { error: deleteError } = await supabase
          .from('delivery_items')
          .delete()
          .eq('id', existingItem.id);

        if (deleteError) {
          console.error('[Assign Load] Delete error:', deleteError);
          return NextResponse.json(
            { ok: false, error: 'Failed to remove from load' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        ok: true,
        orderId,
        loadId: null,
        unassigned: true,
      });
    }

    // Verify the delivery run exists and belongs to this org
    const { data: deliveryRun, error: runError } = await supabase
      .from('delivery_runs')
      .select('id, org_id, load_name')
      .eq('id', loadId)
      .eq('org_id', orgId)
      .single();

    if (runError || !deliveryRun) {
      return NextResponse.json(
        { ok: false, error: 'Delivery run not found' },
        { status: 404 }
      );
    }

    if (existingItem) {
      // Update existing delivery item to point to new load
      const { error: updateError } = await supabase
        .from('delivery_items')
        .update({
          delivery_run_id: loadId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id);

      if (updateError) {
        console.error('[Assign Load] Update error:', updateError);
        return NextResponse.json(
          { ok: false, error: 'Failed to update delivery item' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        deliveryItemId: existingItem.id,
        orderId,
        loadId,
        loadCode: deliveryRun.load_name,
      });
    } else {
      // Create new delivery item with retry logic to handle sequence number race condition
      const deliveryItemId = generateId();
      let sequenceNumber = 1;
      let insertSuccess = false;
      let lastError: Error | null = null;

      // Retry up to 3 times in case of sequence number collision
      for (let attempt = 0; attempt < 3 && !insertSuccess; attempt++) {
        // Get the next sequence number for this delivery run
        const { data: existingItems } = await supabase
          .from('delivery_items')
          .select('sequence_number')
          .eq('delivery_run_id', loadId)
          .order('sequence_number', { ascending: false })
          .limit(1);

        sequenceNumber = existingItems && existingItems.length > 0
          ? (existingItems[0].sequence_number ?? 0) + 1
          : 1;

        const { error: insertError } = await supabase
          .from('delivery_items')
          .insert({
            id: attempt === 0 ? deliveryItemId : generateId(), // Use new ID on retry
            org_id: orgId,
            delivery_run_id: loadId,
            order_id: orderId,
            sequence_number: sequenceNumber,
            trolleys_delivered: order.trolleys_estimated || 0,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (!insertError) {
          insertSuccess = true;
        } else if (insertError.code === '23505') {
          // Unique constraint violation - retry with new sequence
          console.warn(`[Assign Load] Sequence collision on attempt ${attempt + 1}, retrying...`);
          lastError = insertError;
        } else {
          // Different error - don't retry
          console.error('[Assign Load] Insert error:', insertError);
          return NextResponse.json(
            { ok: false, error: 'Failed to create delivery item' },
            { status: 500 }
          );
        }
      }

      if (!insertSuccess) {
        console.error('[Assign Load] Failed after 3 attempts:', lastError);
        return NextResponse.json(
          { ok: false, error: 'Failed to create delivery item after retries' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        deliveryItemId,
        orderId,
        loadId,
        loadCode: deliveryRun.load_name,
        created: true,
      });
    }
  } catch (error: any) {
    console.error('[Assign Load] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
