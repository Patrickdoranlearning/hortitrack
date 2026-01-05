'use server';

import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';

interface QCChecklistState {
  qtyCorrect: boolean;
  varietyCorrect: boolean;
  qualityAcceptable: boolean;
  sizeCorrect: boolean;
  labellingOk: boolean;
}

interface ItemIssue {
  itemId: string;
  issue: string;
  notes: string;
}

interface SubmitQCCheckInput {
  pickListId: string;
  orderId: string;
  checklist: QCChecklistState;
  passed: boolean;
  failedItems: ItemIssue[];
  failureReason: string | null;
}

interface RejectForRepickInput {
  pickListId: string;
  orderId: string;
  failedItems: ItemIssue[];
  failureReason: string;
}

export async function submitQCCheck(input: SubmitQCCheckInput) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();
    const userId = user.id;

    // Create QC check record
    const { data: qcCheck, error: qcError } = await supabase
      .from('order_qc_checks')
      .insert({
        org_id: orgId,
        order_id: input.orderId,
        pick_list_id: input.pickListId,
        qty_correct: input.checklist.qtyCorrect,
        variety_correct: input.checklist.varietyCorrect,
        quality_acceptable: input.checklist.qualityAcceptable,
        size_correct: input.checklist.sizeCorrect,
        labelling_ok: input.checklist.labellingOk,
        status: input.passed ? 'passed' : 'failed',
        failure_reason: input.failureReason,
        failed_items: input.failedItems,
        checked_by: userId,
        checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qcError) {
      console.error('Error creating QC check:', qcError);
      return { error: 'Failed to save QC check' };
    }

    // Update pick list status
    const newStatus = input.passed ? 'qc_passed' : 'qc_failed';
    const { error: pickListError } = await supabase
      .from('pick_lists')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.pickListId);

    if (pickListError) {
      console.error('Error updating pick list status:', pickListError);
      return { error: 'Failed to update pick list status' };
    }

    // Log the event
    await supabase.from('pick_list_events').insert({
      org_id: orgId,
      pick_list_id: input.pickListId,
      event_type: input.passed ? 'qc_passed' : 'qc_failed',
      description: input.passed 
        ? 'QC check passed - ready for dispatch'
        : `QC check failed: ${input.failureReason || 'See item issues'}`,
      metadata: {
        checklist: input.checklist,
        failedItems: input.failedItems,
      },
      created_by: userId,
    });

    // Also log to order_events if passed
    if (input.passed) {
      await supabase.from('order_events').insert({
        org_id: orgId,
        order_id: input.orderId,
        event_type: 'qc_passed',
        description: 'Order passed QC and is ready for dispatch',
        created_by: userId,
      });
    }

    revalidatePath('/dispatch/qc');
    revalidatePath(`/dispatch/qc/${input.pickListId}`);
    revalidatePath(`/sales/orders/${input.orderId}`);

    return { success: true, qcCheck };
  } catch (error) {
    console.error('Error in submitQCCheck:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function rejectForRepick(input: RejectForRepickInput) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();
    const userId = user.id;

    // Create QC check record with failed status
    const { data: qcCheck, error: qcError } = await supabase
      .from('order_qc_checks')
      .insert({
        org_id: orgId,
        order_id: input.orderId,
        pick_list_id: input.pickListId,
        qty_correct: false, // Mark as not fully checked
        variety_correct: false,
        quality_acceptable: false,
        size_correct: false,
        labelling_ok: false,
        status: 'failed',
        failure_reason: input.failureReason,
        failed_items: input.failedItems,
        checked_by: userId,
        checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qcError) {
      console.error('Error creating QC check:', qcError);
      return { error: 'Failed to save QC check' };
    }

    // Reset pick list status back to pending for re-pick
    const { error: pickListError } = await supabase
      .from('pick_lists')
      .update({
        status: 'pending',
        started_at: null,
        completed_at: null,
        started_by: null,
        completed_by: null,
        notes: `QC REJECTED: ${input.failureReason}\n\nItem Issues:\n${input.failedItems.map(i => `- ${i.issue}: ${i.notes}`).join('\n')}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.pickListId);

    if (pickListError) {
      console.error('Error updating pick list status:', pickListError);
      return { error: 'Failed to reset pick list status' };
    }

    // Reset pick items back to pending
    const { error: itemsError } = await supabase
      .from('pick_items')
      .update({
        status: 'pending',
        picked_qty: 0,
        picked_batch_id: null,
        picked_by: null,
        picked_at: null,
      })
      .eq('pick_list_id', input.pickListId);

    if (itemsError) {
      console.error('Error resetting pick items:', itemsError);
    }

    // Log the event
    await supabase.from('pick_list_events').insert({
      org_id: orgId,
      pick_list_id: input.pickListId,
      event_type: 'qc_rejected',
      description: `Returned for re-pick: ${input.failureReason}`,
      metadata: {
        failedItems: input.failedItems,
        reason: input.failureReason,
      },
      created_by: userId,
    });

    // Log to order_events
    await supabase.from('order_events').insert({
      org_id: orgId,
      order_id: input.orderId,
      event_type: 'qc_rejected',
      description: `QC rejected - returned for re-pick. Reason: ${input.failureReason}`,
      created_by: userId,
    });

    revalidatePath('/dispatch/qc');
    revalidatePath('/dispatch/picking');
    revalidatePath(`/dispatch/qc/${input.pickListId}`);
    revalidatePath(`/sales/orders/${input.orderId}`);

    return { success: true };
  } catch (error) {
    console.error('Error in rejectForRepick:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Get QC history for an order
export async function getQCHistory(orderId: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data: checks, error } = await supabase
      .from('order_qc_checks')
      .select(`
        *,
        checked_by_profile:checked_by(display_name, email)
      `)
      .eq('order_id', orderId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching QC history:', error);
      return { error: 'Failed to fetch QC history' };
    }

    return { checks };
  } catch (error) {
    console.error('Error in getQCHistory:', error);
    return { error: 'An unexpected error occurred' };
  }
}





