'use server';

import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/log';
import type { ActionResult } from '@/lib/errors';

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

export async function submitQCCheck(input: SubmitQCCheckInput): Promise<ActionResult<null>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Atomic submission via RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc("submit_qc_check", {
      p_org_id: orgId,
      p_order_id: input.orderId,
      p_pick_list_id: input.pickListId,
      p_user_id: user.id,
      p_passed: input.passed,
      p_checklist: input.checklist as unknown,
      p_failed_items: input.failedItems as unknown,
      p_failure_reason: input.failureReason
    });

    if (rpcError) {
      logError('Error in submit_qc_check RPC', { error: rpcError.message, input });
      return { success: false, error: `Failed to save QC check: ${rpcError.message}` };
    }

    if (!rpcResult?.success) {
      return { success: false, error: rpcResult?.error || 'Failed to submit QC check' };
    }

    revalidatePath('/dispatch/qc');
    revalidatePath(`/dispatch/qc/${input.pickListId}`);
    revalidatePath(`/sales/orders/${input.orderId}`);

    return { success: true, data: null };
  } catch (error) {
    logError('Error in submitQCCheck action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function rejectForRepick(input: RejectForRepickInput): Promise<ActionResult<null>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();
    const userId = user.id;

    // Use atomic RPC to restore stock and reset pick list in single transaction
    const { data: rpcResult, error: rpcError } = await supabase.rpc("reject_pick_list_atomic", {
      p_org_id: orgId,
      p_pick_list_id: input.pickListId,
      p_user_id: userId,
      p_failure_reason: input.failureReason,
      p_failed_items: input.failedItems as unknown,
    });

    if (rpcError) {
      logError('Error in reject_pick_list_atomic RPC', { error: rpcError.message, input });
      return { success: false, error: rpcError.message || 'Failed to reject pick list' };
    }

    if (!rpcResult?.success) {
      logError('reject_pick_list_atomic RPC failed', { error: rpcResult?.error, input });
      return { success: false, error: rpcResult?.error || 'Failed to reject pick list' };
    }

    // Update pick list notes with rejection details (not part of RPC)
    await supabase
      .from('pick_lists')
      .update({
        notes: `QC REJECTED: ${input.failureReason}\n\nItem Issues:\n${input.failedItems.map((i: ItemIssue) => `- ${i.issue}: ${i.notes}`).join('\n')}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.pickListId);

    revalidatePath('/dispatch/qc');
    revalidatePath('/dispatch/picker');
    revalidatePath(`/dispatch/qc/${input.pickListId}`);
    revalidatePath(`/sales/orders/${input.orderId}`);

    return { success: true, data: null };
  } catch (error) {
    logError('Error in rejectForRepick action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function getQCHistory(orderId: string): Promise<ActionResult<{ checks: unknown[] }>> {
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
      logError('Error fetching QC history', { error: error.message, orderId });
      return { success: false, error: 'Failed to fetch QC history' };
    }

    return { success: true, data: { checks: checks ?? [] } };
  } catch (error) {
    logError('Error in getQCHistory action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}
