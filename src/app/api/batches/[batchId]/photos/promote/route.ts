import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const promoteSchema = z.object({
  photoId: z.string().uuid(),
  productId: z.string().uuid(),
});

/**
 * POST /api/batches/[batchId]/photos/promote
 * Promotes a batch photo to be a product's hero image
 * Only SALES photos can be promoted to products
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = promoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { photoId, productId } = parsed.data;

    // Get the batch photo
    const { data: batchPhoto, error: photoError } = await supabase
      .from('batch_photos')
      .select('id, batch_id, url, org_id, type')
      .eq('id', photoId)
      .eq('batch_id', batchId)
      .single();

    if (photoError || !batchPhoto) {
      return NextResponse.json({ ok: false, error: 'Photo not found' }, { status: 404 });
    }

    // Only SALES photos should be promoted to products
    if (batchPhoto.type !== 'SALES') {
      return NextResponse.json(
        { ok: false, error: 'Only sales photos can be promoted to products' },
        { status: 400 }
      );
    }

    // Verify the product belongs to the same org
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, org_id, hero_image_url')
      .eq('id', productId)
      .eq('org_id', batchPhoto.org_id)
      .single();

    if (prodError || !product) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    // Update product hero_image_url to the batch photo URL
    const { error: updateError } = await supabase
      .from('products')
      .update({ hero_image_url: batchPhoto.url })
      .eq('id', productId);

    if (updateError) {
      console.error('Error updating product hero image:', updateError);
      return NextResponse.json({ ok: false, error: 'Failed to update product' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Photo promoted to product hero',
      productId,
      newHeroUrl: batchPhoto.url,
    });
  } catch (error) {
    console.error('Error promoting batch photo:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
