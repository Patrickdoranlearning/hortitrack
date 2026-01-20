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
      console.error('Error creating QC check:', qcError.message, qcError.details, qcError.hint, qcError.code);
      // Provide more specific error messages based on error type
      if (qcError.code === '23503') {
        return { error: 'Invalid order or pick list reference. The order may have been deleted.' };
      }
      if (qcError.code === '42501') {
        return { error: 'Permission denied. You may not have access to save QC checks.' };
      }
      return { error: `Failed to save QC check: ${qcError.message}` };
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
      console.error('Error creating QC check (reject):', qcError.message, qcError.details, qcError.hint, qcError.code);
      if (qcError.code === '23503') {
        return { error: 'Invalid order or pick list reference. The order may have been deleted.' };
      }
      if (qcError.code === '42501') {
        return { error: 'Permission denied. You may not have access to save QC checks.' };
      }
      return { error: `Failed to save QC check: ${qcError.message}` };
    }

    // Use atomic RPC to restore stock and reset pick list in single transaction
    // This prevents partial state if any step fails (e.g., stock restored but pick items not reset)
    const { data: rpcResult, error: rpcError } = await supabase.rpc("reject_pick_list_atomic", {
      p_org_id: orgId,
      p_pick_list_id: input.pickListId,
      p_user_id: userId,
      p_failure_reason: input.failureReason,
      p_failed_items: input.failedItems,
    });

    if (rpcError) {
      console.error('Error in reject_pick_list_atomic:', rpcError);
      return { error: rpcError.message || 'Failed to reject pick list' };
    }

    if (!rpcResult?.success) {
      console.error('reject_pick_list_atomic failed:', rpcResult?.error);
      return { error: rpcResult?.error || 'Failed to reject pick list' };
    }

    // Update pick list notes with rejection details (not part of RPC)
    await supabase
      .from('pick_lists')
      .update({
        notes: `QC REJECTED: ${input.failureReason}\n\nItem Issues:\n${input.failedItems.map((i: { issue: string; notes: string }) => `- ${i.issue}: ${i.notes}`).join('\n')}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.pickListId);

    revalidatePath('/dispatch/qc');
    revalidatePath('/dispatch/picker');
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







