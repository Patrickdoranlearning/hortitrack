import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { generateId } from '@/server/utils/ids';

/**
 * POST /api/dispatch/assign-picker
 * Assign a picker to an order's pick list
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await getUserAndOrg();
    const supabase = await createClient();

    const body = await req.json();
    const { orderId, pickerId } = body;

    console.log('[Assign Picker] Request:', { orderId, pickerId, orgId });

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
      console.error('[Assign Picker] Order not found:', { orderId, orderError });
      return NextResponse.json(
        { ok: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Use upsert to handle race conditions - if another request created the pick list
    // between our check and insert, the upsert will update instead of failing
    const pickListId = generateId();
    const now = new Date().toISOString();

    const { data: result, error: upsertError } = await supabase
      .from('pick_lists')
      .upsert(
        {
          id: pickListId,
          org_id: orgId,
          order_id: orderId,
          assigned_user_id: pickerId || null,
          status: 'pending',
          sequence: 1,
          is_partial: false,
          created_at: now,
          updated_at: now,
        },
        {
          onConflict: 'order_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('[Assign Picker] Upsert error:', upsertError);
      return NextResponse.json(
        { ok: false, error: 'Failed to assign picker: ' + upsertError.message },
        { status: 500 }
      );
    }

    // If the returned ID matches our generated one, we created a new record
    const wasCreated = result.id === pickListId;

    // If we updated an existing record, we need to update the assigned_user_id
    // since upsert with onConflict may not update all fields as expected
    if (!wasCreated) {
      const { error: updateError } = await supabase
        .from('pick_lists')
        .update({
          assigned_user_id: pickerId || null,
          updated_at: now,
        })
        .eq('id', result.id);

      if (updateError) {
        console.error('[Assign Picker] Update error:', updateError);
        return NextResponse.json(
          { ok: false, error: 'Failed to update pick list: ' + updateError.message },
          { status: 500 }
        );
      }
    }

    console.log('[Assign Picker] Pick list result:', { id: result.id, wasCreated });

    return NextResponse.json({
      ok: true,
      pickListId: result.id,
      pickerId,
      created: wasCreated,
    });
  } catch (error: any) {
    console.error('[Assign Picker] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
