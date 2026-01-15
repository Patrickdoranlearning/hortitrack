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
    const { user, orgId } = await getUserAndOrg();
    const userId = user.id;
    const supabase = await createClient();

    const body = await req.json();
    const { orderId, pickerId } = body;

    console.log('[Assign Picker] Request:', {
      orderId,
      pickerId,
      pickerIdType: typeof pickerId,
      orgId,
      userId
    });

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

    const now = new Date().toISOString();

    // Check if pick list already exists for this order
    // Use explicit check + update/insert to avoid FK constraint issues with upsert
    const { data: existing, error: checkError } = await supabase
      .from('pick_lists')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (checkError) {
      console.error('[Assign Picker] Check error:', checkError);
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
        console.error('[Assign Picker] Update error:', updateError);
        return NextResponse.json(
          { ok: false, error: 'Failed to update pick list: ' + updateError.message },
          { status: 500 }
        );
      }

      pickListId = existing.id;
      wasCreated = false;

      // Verify the update was successful by re-fetching
      const { data: verifyUpdate } = await supabase
        .from('pick_lists')
        .select('id, assigned_user_id, status')
        .eq('id', existing.id)
        .single();
      console.log('[Assign Picker] Verified after update:', verifyUpdate);
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
        console.error('[Assign Picker] Insert error:', insertError);
        return NextResponse.json(
          { ok: false, error: 'Failed to create pick list: ' + insertError.message },
          { status: 500 }
        );
      }

      pickListId = inserted.id;
      wasCreated = true;

      // Verify the insert was successful by re-fetching
      const { data: verifyInsert } = await supabase
        .from('pick_lists')
        .select('id, assigned_user_id, status')
        .eq('id', inserted.id)
        .single();
      console.log('[Assign Picker] Verified after insert:', verifyInsert);
    }

    console.log('[Assign Picker] Pick list result:', { id: pickListId, wasCreated, assignedTo: pickerId });

    return NextResponse.json({
      ok: true,
      pickListId,
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
