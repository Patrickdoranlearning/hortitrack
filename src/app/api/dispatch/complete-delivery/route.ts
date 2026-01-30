import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { recordTrolleyMovement, getCustomerTrolleyBalance } from '@/server/dispatch/trolley-balance.server';
import { logger, getErrorMessage } from '@/server/utils/logger';
import type { DeliveryItemUpdate } from '@/lib/dispatch/db-types';

/**
 * POST /api/dispatch/complete-delivery
 * Complete a delivery with trolley return information and optional photo
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const supabase = await createClient();

    const formData = await req.formData();
    const deliveryItemId = formData.get('deliveryItemId') as string;
    const trolleysReturnedStr = formData.get('trolleysReturned') as string;
    const recipientName = formData.get('recipientName') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!deliveryItemId) {
      return NextResponse.json(
        { ok: false, error: 'deliveryItemId is required' },
        { status: 400 }
      );
    }

    const trolleysReturned = parseInt(trolleysReturnedStr, 10) || 0;

    // Verify the delivery item exists and belongs to this org
    const { data: deliveryItem, error: fetchError } = await supabase
      .from('delivery_items')
      .select(`
        id,
        delivery_run_id,
        order_id,
        trolleys_delivered,
        delivery_runs!inner(org_id)
      `)
      .eq('id', deliveryItemId)
      .single();

    if (fetchError || !deliveryItem) {
      return NextResponse.json(
        { ok: false, error: 'Delivery item not found' },
        { status: 404 }
      );
    }

    let photoUrl: string | undefined;

    // Upload photo if provided
    if (photo) {
      const timestamp = Date.now();
      const extension = photo.type.split('/')[1] || 'jpg';
      const filename = `delivery-photos/${orgId}/${deliveryItemId}/${timestamp}.${extension}`;

      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filename, buffer, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadError) {
        logger.dispatch.warn('Photo upload failed, continuing without photo', { deliveryItemId, error: uploadError.message });
        // Continue without photo
      } else {
        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(filename);
        if (urlData?.publicUrl) {
          photoUrl = urlData.publicUrl;
        } else {
          logger.dispatch.warn('Failed to get public URL for uploaded photo', { deliveryItemId });
        }
      }
    }

    // Update the delivery item with trolley return info and status
    const updatePayload: DeliveryItemUpdate = {
      status: 'delivered',
      trolleys_returned: trolleysReturned,
      actual_delivery_time: new Date().toISOString(),
    };

    if (photoUrl) {
      updatePayload.delivery_photo_url = photoUrl;
    }

    if (recipientName?.trim()) {
      updatePayload.recipient_name = recipientName.trim();
    }

    const { error: updateError } = await supabase
      .from('delivery_items')
      .update(updatePayload)
      .eq('id', deliveryItemId);

    if (updateError) {
      logger.dispatch.error('Error updating delivery item', updateError, { deliveryItemId });
      return NextResponse.json(
        { ok: false, error: 'Failed to update delivery' },
        { status: 500 }
      );
    }

    // Get customer info for equipment movement log
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id')
      .eq('id', deliveryItem.order_id)
      .single();

    if (orderError) {
      logger.dispatch.warn('Error fetching order data for delivery', { orderId: deliveryItem.order_id, error: orderError.message });
    }

    // Record equipment movements using centralized function
    // The database trigger will automatically update customer_trolley_balance
    const trolleysDelivered = deliveryItem.trolleys_delivered || 0;

    if (trolleysDelivered > 0 && orderData?.customer_id) {
      const result = await recordTrolleyMovement({
        type: 'delivered',
        customerId: orderData.customer_id,
        trolleys: trolleysDelivered,
        deliveryRunId: deliveryItem.delivery_run_id,
      });
      if (!result.success) {
        logger.dispatch.warn('Error logging delivered equipment', { error: result.error, customerId: orderData.customer_id });
      }
    }

    if (trolleysReturned > 0 && orderData?.customer_id) {
      const result = await recordTrolleyMovement({
        type: 'returned',
        customerId: orderData.customer_id,
        trolleys: trolleysReturned,
        deliveryRunId: deliveryItem.delivery_run_id,
      });
      if (!result.success) {
        logger.dispatch.warn('Error logging returned equipment', { error: result.error, customerId: orderData.customer_id });
      }
    }

    // Log the delivery event
    if (orderData?.id) {
      const outstanding = trolleysDelivered - trolleysReturned;
      const { error: eventError } = await supabase.from('order_events').insert({
        org_id: orgId,
        order_id: orderData.id,
        event_type: 'delivered',
        description: `Order delivered. ${trolleysDelivered} trolleys delivered, ${trolleysReturned} returned. ${outstanding > 0 ? `${outstanding} outstanding.` : ''}`,
        metadata: {
          photoUrl,
          deliveryItemId,
          trolleysDelivered,
          trolleysReturned,
          trolleysOutstanding: outstanding,
          recipientName: recipientName?.trim() || null,
        },
        created_by: userId,
      });
      if (eventError) {
        logger.dispatch.warn('Error logging delivery event', { orderId: orderData.id, error: eventError.message });
      }
    }

    // Get updated customer balance to return
    let customerBalance = null;
    if (orderData?.customer_id) {
      const balance = await getCustomerTrolleyBalance(orderData.customer_id);
      if (balance) {
        customerBalance = {
          trolleysOut: balance.trolleysOut,
          shelvesOut: balance.shelvesOut,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      photoUrl,
      deliveryItemId,
      trolleysReturned,
      trolleysOutstanding: trolleysDelivered - trolleysReturned,
      customerBalance,
    });
  } catch (error) {
    logger.dispatch.error('Error in complete-delivery route', error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
