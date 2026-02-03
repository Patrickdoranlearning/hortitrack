'use server';

import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { logError, logInfo } from '@/lib/log';
import { nextBatchNumber } from '@/server/numbering/batches';

// ============================================================================
// Types
// ============================================================================

export type LogBatchMoveInput = {
  batchId: string;
  locationId: string;
  quantity?: number; // undefined = full batch
  notes?: string;
};

export type LogBatchDumpInput = {
  batchId: string;
  reason: string;
  quantity?: number; // undefined = full batch
  notes?: string;
};

export type BatchActionResult<T = void> =
  | { success: true; data?: T; splitBatchId?: string; splitBatchNumber?: string; newQuantity?: number }
  | { success: false; error: string };

// ============================================================================
// Phase mapping for batch numbering
// ============================================================================

const PHASE_COUNTER: Record<string, 1 | 2 | 3> = {
  propagation: 1,
  propagating: 1,
  plug: 2,
  growing: 2,
  liners: 2,
  finished: 3,
  potted: 3,
};

function mapPhaseToCounter(phase?: string | null): 1 | 2 | 3 {
  if (!phase) return 2;
  const normalized = phase.toLowerCase();
  return PHASE_COUNTER[normalized] ?? 2;
}

// ============================================================================
// Move Batch
// ============================================================================

/**
 * Moves a batch (or part of a batch) to a new location
 * Partial moves create a new child batch
 */
export async function logBatchMove(
  input: LogBatchMoveInput
): Promise<BatchActionResult<{ moveId?: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get current batch
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, org_id, batch_number, quantity, initial_quantity, phase, status, status_id, plant_variety_id, size_id, location_id, supplier_id, planted_at, unit')
      .eq('id', input.batchId)
      .eq('org_id', orgId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    // Get destination location
    const { data: location, error: locError } = await supabase
      .from('nursery_locations')
      .select('id, name')
      .eq('id', input.locationId)
      .eq('org_id', orgId)
      .single();

    if (locError || !location) {
      return { success: false, error: 'Destination location not found' };
    }

    const currentQty = batch.quantity ?? 0;
    if (currentQty <= 0) {
      return { success: false, error: 'Batch has no remaining quantity to move' };
    }

    const qty = Math.min(input.quantity ?? currentQty, currentQty);
    if (qty <= 0) {
      return { success: false, error: 'Quantity must be greater than zero' };
    }

    const isPartial = qty < currentQty;
    const occurredAt = new Date();

    let splitBatchId: string | null = null;
    let splitBatchNumber: string | null = null;
    let quantityAfter = currentQty;

    if (isPartial) {
      // Partial move: decrement source, create child batch
      const { data: remainingQty, error: decrError } = await supabase.rpc(
        'decrement_batch_quantity',
        {
          p_org_id: orgId,
          p_batch_id: batch.id,
          p_units: qty,
        }
      );

      if (decrError) {
        return { success: false, error: decrError.message };
      }

      quantityAfter = Number(remainingQty ?? 0);

      // Create child batch
      const phaseCounter = mapPhaseToCounter(batch.phase);
      const newBatchNumber = await nextBatchNumber(phaseCounter);

      const { data: child, error: childErr } = await supabase
        .from('batches')
        .insert({
          org_id: orgId,
          batch_number: newBatchNumber,
          phase: batch.phase ?? 'growing',
          plant_variety_id: batch.plant_variety_id,
          size_id: batch.size_id,
          location_id: location.id,
          status: batch.status ?? 'Growing',
          status_id: batch.status_id,
          quantity: qty,
          initial_quantity: qty,
          unit: batch.unit ?? 'plants',
          planted_at: batch.planted_at ?? null,
          supplier_id: batch.supplier_id,
          parent_batch_id: batch.id,
        })
        .select('id, batch_number')
        .single();

      if (childErr || !child) {
        // Rollback quantity decrement
        await supabase.rpc('decrement_batch_quantity', {
          p_org_id: orgId,
          p_batch_id: batch.id,
          p_units: -qty,
        });
        return { success: false, error: childErr?.message ?? 'Failed to create split batch' };
      }

      splitBatchId = child.id;
      splitBatchNumber = child.batch_number;

      // Create ancestry record
      const proportion = currentQty > 0 ? Number((qty / currentQty).toFixed(4)) : 1;
      await supabase.from('batch_ancestry').insert({
        org_id: orgId,
        parent_batch_id: batch.id,
        child_batch_id: child.id,
        proportion,
      });

      // Create MOVE_IN event for child batch
      await supabase.from('batch_events').insert({
        batch_id: child.id,
        org_id: orgId,
        type: 'MOVE_IN',
        by_user_id: user.id,
        at: occurredAt.toISOString(),
        payload: JSON.stringify({
          from_batch_id: batch.id,
          from_batch_number: batch.batch_number,
          units_received: qty,
          location_id: location.id,
          location_name: location.name,
          notes: input.notes ?? null,
        }),
      });
    } else {
      // Full move: just update location
      const { error: updateErr } = await supabase
        .from('batches')
        .update({
          location_id: location.id,
          updated_at: occurredAt.toISOString(),
        })
        .eq('id', batch.id)
        .eq('org_id', orgId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }
    }

    // Create MOVE event for source batch
    await supabase.from('batch_events').insert({
      batch_id: batch.id,
      org_id: orgId,
      type: 'MOVE',
      by_user_id: user.id,
      at: occurredAt.toISOString(),
      payload: JSON.stringify({
        units_moved: qty,
        partial: isPartial,
        to_location_id: location.id,
        to_location_name: location.name,
        notes: input.notes ?? null,
        split_batch_id: splitBatchId,
        split_batch_number: splitBatchNumber,
      }),
    });

    logInfo('Batch move logged', {
      batchId: input.batchId,
      batchNumber: batch.batch_number,
      locationId: location.id,
      quantity: qty,
      isPartial,
      splitBatchNumber,
    });

    revalidatePath(`/production/batches/${input.batchId}`);
    if (splitBatchId) {
      revalidatePath(`/production/batches/${splitBatchId}`);
    }
    revalidatePath('/production');

    return {
      success: true,
      splitBatchId: splitBatchId ?? undefined,
      splitBatchNumber: splitBatchNumber ?? undefined,
      newQuantity: quantityAfter,
    };
  } catch (error) {
    logError('Error in logBatchMove', { error: String(error) });
    return { success: false, error: 'Failed to move batch' };
  }
}

// ============================================================================
// Dump/Loss Batch
// ============================================================================

/**
 * Records a dump/loss against a batch
 * If quantity matches full batch, archives the batch
 */
export async function logBatchDump(
  input: LogBatchDumpInput
): Promise<BatchActionResult<{ eventId?: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    if (!input.reason || !input.reason.trim()) {
      return { success: false, error: 'Reason is required' };
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
    if (currentQty <= 0) {
      return { success: false, error: 'Batch has no quantity to dump' };
    }

    const qty = Math.min(input.quantity ?? currentQty, currentQty);
    if (qty <= 0) {
      return { success: false, error: 'Quantity must be greater than zero' };
    }

    // Decrement quantity
    const { data: remainingQty, error: decrError } = await supabase.rpc(
      'decrement_batch_quantity',
      {
        p_org_id: orgId,
        p_batch_id: batch.id,
        p_units: qty,
      }
    );

    if (decrError) {
      return { success: false, error: decrError.message };
    }

    const quantityAfter = Number(remainingQty ?? 0);
    const shouldArchive = quantityAfter === 0;
    const occurredAt = new Date();

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      quantity: quantityAfter,
      updated_at: occurredAt.toISOString(),
    };

    if (shouldArchive) {
      updatePayload.status = 'Archived';
      updatePayload.archived_at = occurredAt.toISOString();

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

    // Update batch
    const { error: updateErr } = await supabase
      .from('batches')
      .update(updatePayload)
      .eq('id', batch.id)
      .eq('org_id', orgId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Create DUMP event
    const { data: event, error: eventError } = await supabase
      .from('batch_events')
      .insert({
        org_id: orgId,
        batch_id: batch.id,
        type: 'DUMP',
        at: occurredAt.toISOString(),
        by_user_id: user.id,
        payload: JSON.stringify({
          units: qty,
          units_dumped: qty, // Backwards compatibility
          reason: input.reason,
          notes: input.notes ?? null,
          archived: shouldArchive,
        }),
      })
      .select('id')
      .single();

    if (eventError) {
      logError('Failed to create dump event', { error: eventError.message });
    }

    logInfo('Batch dump logged', {
      batchId: input.batchId,
      batchNumber: batch.batch_number,
      quantity: qty,
      reason: input.reason,
      archived: shouldArchive,
    });

    revalidatePath(`/production/batches/${input.batchId}`);
    revalidatePath('/production');

    return {
      success: true,
      data: { eventId: event?.id || '' },
      newQuantity: quantityAfter,
    };
  } catch (error) {
    logError('Error in logBatchDump', { error: String(error) });
    return { success: false, error: 'Failed to log dump' };
  }
}
