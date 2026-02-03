'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { logError, logInfo } from '@/lib/log';
import {
  type AdjustmentReason,
  type LossReason,
  ADJUSTMENT_REASON_LABELS,
  LOSS_REASON_LABELS,
} from '@/lib/shared/batch-stock-constants';

// Re-export types for consumers (types are allowed in 'use server' files)
export type { AdjustmentReason, LossReason };

// ============================================================================
// Types
// ============================================================================

export type StockAdjustmentInput = {
  batchId: string;
  quantity: number; // Positive for increase, negative for decrease
  reason: AdjustmentReason;
  notes?: string;
};

export type LossRecordInput = {
  batchId: string;
  quantity: number; // Always positive - will be subtracted
  reason: LossReason;
  notes?: string;
};

export type BatchStockResult<T = void> =
  | { success: true; data?: T; newQuantity?: number }
  | { success: false; error: string };

// ============================================================================
// Stock Adjustment
// ============================================================================

/**
 * Adjusts batch stock quantity with an audit trail
 * Can increase or decrease stock with a reason
 */
export async function adjustBatchStock(
  input: StockAdjustmentInput
): Promise<BatchStockResult<{ eventId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get current batch
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, quantity, batch_number')
      .eq('id', input.batchId)
      .eq('org_id', orgId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    const currentQty = batch.quantity ?? 0;
    const newQty = currentQty + input.quantity;

    // Validate new quantity isn't negative
    if (newQty < 0) {
      return {
        success: false,
        error: `Cannot reduce quantity below zero. Current: ${currentQty}, Adjustment: ${input.quantity}`,
      };
    }

    // Update batch quantity
    const { error: updateError } = await supabase
      .from('batches')
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.batchId)
      .eq('org_id', orgId);

    if (updateError) {
      logError('Failed to update batch quantity', { error: updateError.message });
      return { success: false, error: updateError.message };
    }

    // Create batch event
    const eventPayload = {
      qty_change: input.quantity,
      previous_quantity: currentQty,
      new_quantity: newQty,
      reason: input.reason,
      reason_label: ADJUSTMENT_REASON_LABELS[input.reason],
      notes: input.notes || null,
    };

    const { data: event, error: eventError } = await supabase
      .from('batch_events')
      .insert({
        org_id: orgId,
        batch_id: input.batchId,
        type: 'ADJUSTMENT',
        at: new Date().toISOString(),
        by_user_id: user.id,
        payload: eventPayload,
      })
      .select('id')
      .single();

    if (eventError) {
      logError('Failed to create adjustment event', { error: eventError.message });
      // Don't fail the whole operation - adjustment was made
    }

    logInfo('Batch stock adjusted', {
      batchId: input.batchId,
      batchNumber: batch.batch_number,
      adjustment: input.quantity,
      reason: input.reason,
      newQuantity: newQty,
    });

    revalidatePath(`/production/batches/${input.batchId}`);
    revalidatePath('/production');

    return {
      success: true,
      data: { eventId: event?.id || '' },
      newQuantity: newQty,
    };
  } catch (error) {
    logError('Error in adjustBatchStock', { error: String(error) });
    return { success: false, error: 'Failed to adjust stock' };
  }
}

// ============================================================================
// Loss Recording
// ============================================================================

/**
 * Records a loss against a batch (always subtracts)
 * Creates proper audit trail with loss reason categorization
 */
export async function recordBatchLoss(
  input: LossRecordInput
): Promise<BatchStockResult<{ eventId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    if (input.quantity <= 0) {
      return { success: false, error: 'Loss quantity must be positive' };
    }

    // Get current batch
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, quantity, batch_number, status, status_id')
      .eq('id', input.batchId)
      .eq('org_id', orgId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    const currentQty = batch.quantity ?? 0;
    const lossQty = Math.min(input.quantity, currentQty); // Can't lose more than we have
    const newQty = currentQty - lossQty;

    // Determine if batch should be archived
    const shouldArchive = newQty === 0;

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      quantity: newQty,
      updated_at: new Date().toISOString(),
    };

    if (shouldArchive) {
      updatePayload.status = 'Archived';
      updatePayload.archived_at = new Date().toISOString();

      // Get archived status_id
      const { data: statusOpt } = await supabase
        .from('attribute_options')
        .select('id')
        .eq('org_id', orgId)
        .eq('attribute_key', 'production_status')
        .or('system_code.eq.Archived,display_label.eq.Archived')
        .single();

      if (statusOpt) {
        updatePayload.status_id = statusOpt.id;
      }
    }

    // Update batch quantity
    const { error: updateError } = await supabase
      .from('batches')
      .update(updatePayload)
      .eq('id', input.batchId)
      .eq('org_id', orgId);

    if (updateError) {
      logError('Failed to record loss', { error: updateError.message });
      return { success: false, error: updateError.message };
    }

    // Create batch event (LOSS type, similar to DUMP)
    const eventPayload = {
      units: lossQty,
      units_dumped: lossQty, // Backwards compatibility
      qty_change: -lossQty,
      previous_quantity: currentQty,
      new_quantity: newQty,
      reason: input.reason,
      reason_label: LOSS_REASON_LABELS[input.reason],
      notes: input.notes || null,
      archived: shouldArchive,
    };

    const { data: event, error: eventError } = await supabase
      .from('batch_events')
      .insert({
        org_id: orgId,
        batch_id: input.batchId,
        type: 'LOSS',
        at: new Date().toISOString(),
        by_user_id: user.id,
        payload: eventPayload,
      })
      .select('id')
      .single();

    if (eventError) {
      logError('Failed to create loss event', { error: eventError.message });
    }

    logInfo('Batch loss recorded', {
      batchId: input.batchId,
      batchNumber: batch.batch_number,
      lossQuantity: lossQty,
      reason: input.reason,
      newQuantity: newQty,
      archived: shouldArchive,
    });

    revalidatePath(`/production/batches/${input.batchId}`);
    revalidatePath('/production');

    return {
      success: true,
      data: { eventId: event?.id || '' },
      newQuantity: newQty,
    };
  } catch (error) {
    logError('Error in recordBatchLoss', { error: String(error) });
    return { success: false, error: 'Failed to record loss' };
  }
}

// ============================================================================
// Get Batch Current Stock
// ============================================================================

export async function getBatchStock(batchId: string): Promise<BatchStockResult<{
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data: batch, error } = await supabase
      .from('batches')
      .select('quantity, reserved_quantity')
      .eq('id', batchId)
      .eq('org_id', orgId)
      .single();

    if (error || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    const qty = batch.quantity ?? 0;
    const reserved = batch.reserved_quantity ?? 0;

    return {
      success: true,
      data: {
        quantity: qty,
        reservedQuantity: reserved,
        availableQuantity: Math.max(0, qty - reserved),
      },
    };
  } catch (error) {
    return { success: false, error: 'Failed to get batch stock' };
  }
}
