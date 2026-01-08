import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { z } from 'zod';

const CreateFeedbackSchema = z.object({
  pickListId: z.string().uuid(),
  pickItemId: z.string().uuid().optional(),
  issueType: z.enum(['wrong_item', 'wrong_qty', 'quality_issue', 'missing_label', 'damaged', 'other']),
  notes: z.string().optional(),
  actionRequired: z.enum(['repick', 'relabel', 'accept']).optional(),
});

/**
 * POST /api/dispatch/qc/feedback
 * Create QC feedback for a picker
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await getUserAndOrg();
    const supabase = await createClient();

    const body = await req.json();
    const result = CreateFeedbackSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { pickListId, pickItemId, issueType, notes, actionRequired } = result.data;

    // Verify the pick list exists and belongs to this org
    const { data: pickList, error: pickListError } = await supabase
      .from('pick_lists')
      .select('id, assigned_user_id, order_id')
      .eq('id', pickListId)
      .eq('org_id', orgId)
      .single();

    if (pickListError || !pickList) {
      return NextResponse.json(
        { ok: false, error: 'Pick list not found' },
        { status: 404 }
      );
    }

    // Create the feedback record
    const { data: feedback, error: insertError } = await supabase
      .from('qc_feedback')
      .insert({
        org_id: orgId,
        pick_list_id: pickListId,
        pick_item_id: pickItemId,
        issue_type: issueType,
        notes,
        action_required: actionRequired,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[QC Feedback] Insert error:', insertError);
      return NextResponse.json(
        { ok: false, error: 'Failed to create feedback' },
        { status: 500 }
      );
    }

    // If there's an assigned picker, mark as notified
    if (pickList.assigned_user_id) {
      const { error: notifyError } = await supabase
        .from('qc_feedback')
        .update({ picker_notified_at: new Date().toISOString() })
        .eq('id', feedback.id);
      if (notifyError) {
        console.error('[QC Feedback] Error updating notification timestamp:', notifyError);
      }
    }

    // Log the event
    const { error: eventError } = await supabase.from('pick_list_events').insert({
      org_id: orgId,
      pick_list_id: pickListId,
      event_type: 'qc_feedback_created',
      description: `QC feedback: ${issueType}${notes ? ` - ${notes}` : ''}`,
      metadata: { feedbackId: feedback.id, issueType, actionRequired },
      created_by: userId,
    });
    if (eventError) {
      console.error('[QC Feedback] Error logging event:', eventError);
    }

    return NextResponse.json({ ok: true, feedback });
  } catch (error: any) {
    console.error('[QC Feedback] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dispatch/qc/feedback
 * Get feedback for the current picker (my feedback)
 * Query params:
 * - pickerId: filter by specific picker (for managers)
 * - unacknowledged: only show unacknowledged feedback
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await getUserAndOrg();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const pickerId = searchParams.get('pickerId');
    const unacknowledged = searchParams.get('unacknowledged') === 'true';
    const targetPickerId = pickerId || userId;

    // First, get the pick_list IDs assigned to this picker
    const { data: pickerLists, error: pickerListsError } = await supabase
      .from('pick_lists')
      .select('id')
      .eq('org_id', orgId)
      .eq('assigned_user_id', targetPickerId);

    if (pickerListsError) {
      console.error('[QC Feedback] Error fetching picker lists:', pickerListsError);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch picker data' },
        { status: 500 }
      );
    }

    const pickListIds = (pickerLists || []).map(pl => pl.id);

    // If no pick lists, return empty
    if (pickListIds.length === 0) {
      return NextResponse.json({
        ok: true,
        feedback: [],
        unacknowledgedCount: 0,
      });
    }

    // Now fetch feedback for those pick lists
    let query = supabase
      .from('qc_feedback')
      .select(`
        *,
        pick_list:pick_list_id (
          id,
          sequence,
          status,
          assigned_user_id,
          order:order_id (
            id,
            order_number,
            customer:customer_id (name)
          )
        ),
        pick_item:pick_item_id (
          id,
          product_id,
          sku,
          variety,
          requested_qty
        ),
        created_by_profile:profiles!qc_feedback_created_by_fkey (display_name, full_name)
      `)
      .eq('org_id', orgId)
      .in('pick_list_id', pickListIds)
      .order('created_at', { ascending: false });

    // Filter unacknowledged
    if (unacknowledged) {
      query = query.is('picker_acknowledged_at', null);
    }

    const { data: feedback, error } = await query;

    if (error) {
      console.error('[QC Feedback] GET error:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch feedback' },
        { status: 500 }
      );
    }

    // Count unacknowledged for badge
    const { count } = await supabase
      .from('qc_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('pick_list_id', pickListIds)
      .is('picker_acknowledged_at', null);

    return NextResponse.json({
      ok: true,
      feedback: feedback || [],
      unacknowledgedCount: count || 0,
    });
  } catch (error: any) {
    console.error('[QC Feedback] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
