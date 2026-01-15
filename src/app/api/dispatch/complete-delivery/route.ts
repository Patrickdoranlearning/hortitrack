import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { recordTrolleyMovement, getCustomerTrolleyBalance } from '@/server/dispatch/trolley-balance.server';

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
        console.error('[Complete Delivery] Photo upload error:', uploadError);
        // Continue without photo
      } else {
        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(filename);
        if (urlData?.publicUrl) {
          photoUrl = urlData.publicUrl;
        } else {
          console.error('[Complete Delivery] Failed to get public URL for uploaded photo');
        }
      }
    }

    // Update the delivery item with trolley return info and status
    const updatePayload: Record<string, any> = {
      status: 'delivered',
      trolleys_returned: trolleysReturned,
      actual_delivery_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      console.error('[Complete Delivery] Update error:', updateError);
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
      console.error('[Complete Delivery] Error fetching order data:', orderError);
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
        console.error('[Complete Delivery] Error logging delivered equipment:', result.error);
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
        console.error('[Complete Delivery] Error logging returned equipment:', result.error);
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
        console.error('[Complete Delivery] Error logging delivery event:', eventError);
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
  } catch (error: any) {
    console.error('[Complete Delivery] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
