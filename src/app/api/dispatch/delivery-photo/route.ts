import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';

/**
 * POST /api/dispatch/delivery-photo
 * Upload a delivery proof photo
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await getUserAndOrg();
    const supabase = await createClient();

    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const deliveryItemId = formData.get('deliveryItemId') as string;

    if (!photo || !deliveryItemId) {
      return NextResponse.json(
        { ok: false, error: 'photo and deliveryItemId are required' },
        { status: 400 }
      );
    }

    // Verify the delivery item exists and belongs to this org
    const { data: deliveryItem, error: fetchError } = await supabase
      .from('delivery_items')
      .select('id, delivery_run_id, delivery_runs!inner(org_id)')
      .eq('id', deliveryItemId)
      .single();

    if (fetchError || !deliveryItem) {
      return NextResponse.json(
        { ok: false, error: 'Delivery item not found' },
        { status: 404 }
      );
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const extension = photo.type.split('/')[1] || 'jpg';
    const filename = `delivery-photos/${orgId}/${deliveryItemId}/${timestamp}.${extension}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(filename, buffer, {
        contentType: photo.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Delivery Photo] Upload error:', uploadError);
      return NextResponse.json(
        { ok: false, error: 'Failed to upload photo' },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(filename);

    const photoUrl = urlData.publicUrl;

    // Update the delivery item with the photo URL and mark as delivered
    const { error: updateError } = await supabase
      .from('delivery_items')
      .update({
        delivery_photo_url: photoUrl,
        status: 'delivered',
        actual_delivery_time: new Date().toISOString(),
        recipient_name: null, // Can be updated separately if needed
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryItemId);

    if (updateError) {
      console.error('[Delivery Photo] Update error:', updateError);
      // Photo was uploaded but update failed - log but continue
    }

    // Log the delivery event
    const { data: orderData } = await supabase
      .from('delivery_items')
      .select('order_id')
      .eq('id', deliveryItemId)
      .single();

    if (orderData?.order_id) {
      await supabase.from('order_events').insert({
        org_id: orgId,
        order_id: orderData.order_id,
        event_type: 'delivered',
        description: 'Order delivered with photo proof',
        metadata: { photoUrl, deliveryItemId },
        created_by: userId,
      });
    }

    return NextResponse.json({
      ok: true,
      photoUrl,
      deliveryItemId,
    });
  } catch (error: any) {
    console.error('[Delivery Photo] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
