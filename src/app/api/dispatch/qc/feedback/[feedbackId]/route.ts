import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';

interface RouteParams {
  params: Promise<{ feedbackId: string }>;
}

/**
 * GET /api/dispatch/qc/feedback/[feedbackId]
 * Get a specific feedback item
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { feedbackId } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await createClient();

    const { data: feedback, error } = await supabase
      .from('qc_feedback')
      .select(`
        *,
        pick_lists:pick_list_id (
          id,
          sequence,
          status,
          assigned_user_id,
          order:order_id (
            id,
            order_number,
            customers:customer_id (name)
          )
        ),
        pick_items:pick_item_id (
          id,
          product_id,
          sku,
          variety,
          requested_qty
        ),
        created_by_profile:created_by (display_name)
      `)
      .eq('id', feedbackId)
      .eq('org_id', orgId)
      .single();

    if (error || !feedback) {
      return NextResponse.json(
        { ok: false, error: 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, feedback });
  } catch (error: any) {
    console.error('[QC Feedback] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dispatch/qc/feedback/[feedbackId]
 * Update feedback (acknowledge, resolve, etc.)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { feedbackId } = await params;
    const { userId, orgId } = await getUserAndOrg();
    const supabase = await createClient();

    const body = await req.json();
    const { action, resolutionNotes } = body;

    // Get the existing feedback
    const { data: existingFeedback, error: fetchError } = await supabase
      .from('qc_feedback')
      .select('*, pick_lists:pick_list_id(assigned_user_id)')
      .eq('id', feedbackId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existingFeedback) {
      return NextResponse.json(
        { ok: false, error: 'Feedback not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, any> = {};

    switch (action) {
      case 'acknowledge':
        // Picker acknowledges seeing the feedback
        const assignedUserId = existingFeedback.pick_lists?.assigned_user_id;
        if (assignedUserId && assignedUserId !== userId) {
          return NextResponse.json(
            { ok: false, error: 'Only the assigned picker can acknowledge this feedback' },
            { status: 403 }
          );
        }
        updates.picker_acknowledged_at = new Date().toISOString();
        break;

      case 'resolve':
        // Manager or picker marks as resolved
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = userId;
        if (resolutionNotes) {
          updates.resolution_notes = resolutionNotes;
        }
        break;

      default:
        return NextResponse.json(
          { ok: false, error: 'Invalid action. Use "acknowledge" or "resolve".' },
          { status: 400 }
        );
    }

    const { data: feedback, error: updateError } = await supabase
      .from('qc_feedback')
      .update(updates)
      .eq('id', feedbackId)
      .select()
      .single();

    if (updateError) {
      console.error('[QC Feedback] Update error:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, feedback });
  } catch (error: any) {
    console.error('[QC Feedback] PATCH error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
