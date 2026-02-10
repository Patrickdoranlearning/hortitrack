'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { logError, logInfo } from '@/lib/log';
import type { ActionResult } from '@/lib/errors';

// ============================================================================
// Types
// ============================================================================

export type BatchHealthEventType =
  | 'treatment'
  | 'fertilizer'
  | 'irrigation'
  | 'pruning'
  | 'weeding'
  | 'grading'
  | 'measurement'
  | 'spacing';

export type BatchHealthEventInput = {
  batchId: string;
  eventType: BatchHealthEventType;
  // Treatment fields
  productName?: string;
  ipmProductId?: string;
  bottleId?: string;
  quantityUsedMl?: number;
  rate?: number;
  rateUnit?: string;
  method?: string;
  weatherConditions?: string;
  areaTreated?: string;
  sprayerUsed?: string;
  reasonForUse?: string;
  harvestIntervalDays?: number;
  safeHarvestDate?: string;
  pcsNumber?: string;
  // Measurement fields
  ecReading?: number;
  phReading?: number;
  // Fertilizer fields
  fertilizerComposition?: string;
  // Common fields
  notes?: string;
  photoUrl?: string;
};

/** @deprecated Use ActionResult from '@/lib/errors' instead */
export type BatchHealthResult<T = void> =
  | { success: true; data?: T; logId?: string }
  | { success: false; error: string };

// ============================================================================
// Map event type to database enum
// ============================================================================

function mapEventTypeToDbEnum(eventType: BatchHealthEventType): string {
  // The database enum is: 'scout_flag', 'treatment', 'measurement', 'clearance'
  // We map our UI types to these + store additional context in notes
  switch (eventType) {
    case 'treatment':
      return 'treatment';
    case 'fertilizer':
      // Fertilizer is stored as treatment with specific product_name
      return 'treatment';
    case 'irrigation':
      // Irrigation stored as treatment with method='irrigation'
      return 'treatment';
    case 'pruning':
      // Pruning/weeding/grading/spacing are logged as clearance (general maintenance)
      return 'clearance';
    case 'weeding':
      return 'clearance';
    case 'grading':
      return 'clearance';
    case 'spacing':
      return 'clearance';
    case 'measurement':
      return 'measurement';
    default:
      return 'treatment';
  }
}

// ============================================================================
// Log Batch Health Event
// ============================================================================

/**
 * Logs a health event directly against a batch (not location-based)
 * Creates entry in plant_health_logs and optionally a batch_event for history
 */
export async function logBatchHealthEvent(
  input: BatchHealthEventInput
): Promise<ActionResult<{ logId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Build the insert data
    const insertData: Record<string, unknown> = {
      org_id: orgId,
      batch_id: input.batchId,
      location_id: null, // Batch-level, not location-level
      event_type: mapEventTypeToDbEnum(input.eventType),
      event_at: new Date().toISOString(),
      recorded_by: user.id,
      notes: input.notes,
      photo_url: input.photoUrl,
    };

    // Treatment/fertilizer specific fields
    if (input.eventType === 'treatment' || input.eventType === 'fertilizer' || input.eventType === 'irrigation') {
      insertData.product_name = input.productName;
      insertData.rate = input.rate;
      insertData.unit = input.rateUnit;
      insertData.method = input.method || (input.eventType === 'irrigation' ? 'Irrigation' : null);
      insertData.reason_for_use = input.reasonForUse;
      insertData.weather_conditions = input.weatherConditions;
      insertData.area_treated = input.areaTreated;
      insertData.sprayer_used = input.sprayerUsed;
      insertData.harvest_interval_days = input.harvestIntervalDays;
      insertData.safe_harvest_date = input.safeHarvestDate;
      insertData.fertiliser_composition = input.fertilizerComposition;
      insertData.pcs_number = input.pcsNumber;

      if (input.ipmProductId) {
        insertData.ipm_product_id = input.ipmProductId;
      }

      // Add title for display
      if (input.eventType === 'fertilizer') {
        insertData.title = `Fertilizer: ${input.productName || 'Applied'}`;
      } else if (input.eventType === 'irrigation') {
        insertData.title = `Irrigation: ${input.method || 'Applied'}`;
      } else {
        insertData.title = `Treatment: ${input.productName || 'Applied'}`;
      }
    }

    // Measurement specific fields
    if (input.eventType === 'measurement') {
      insertData.ec_reading = input.ecReading;
      insertData.ph_reading = input.phReading;
      const parts: string[] = [];
      if (input.ecReading != null) parts.push(`EC: ${input.ecReading}`);
      if (input.phReading != null) parts.push(`pH: ${input.phReading}`);
      insertData.title = `Measurement: ${parts.join(', ') || 'Recorded'}`;
    }

    // Pruning/weeding/grading/spacing
    if (input.eventType === 'pruning') {
      insertData.title = 'Pruning';
    }
    if (input.eventType === 'weeding') {
      insertData.title = 'Weeding';
    }
    if (input.eventType === 'grading') {
      insertData.title = 'Grading';
    }
    if (input.eventType === 'spacing') {
      insertData.title = 'Spacing';
    }

    // Insert the health log
    const { data, error } = await supabase
      .from('plant_health_logs')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      logError('Failed to log batch health event', { error: error.message, input });
      return { success: false, error: error.message };
    }

    // Also create a batch_event for the history timeline (optional, for certain event types)
    if (input.eventType === 'treatment' || input.eventType === 'fertilizer') {
      const batchEventData: Record<string, unknown> = {
        org_id: orgId,
        batch_id: input.batchId,
        type: input.eventType === 'treatment' ? 'TREATMENT' : 'FERTILIZE',
        at: new Date().toISOString(),
        by_user_id: user.id,
        payload: {
          health_log_id: data.id,
          product_name: input.productName,
          rate: input.rate,
          rate_unit: input.rateUnit,
          method: input.method,
          notes: input.productName
            ? `${input.productName}${input.rate ? ` @ ${input.rate} ${input.rateUnit || ''}` : ''}`
            : input.notes,
        },
      };

      await supabase.from('batch_events').insert(batchEventData);
    }

    // Update IPM stock if bottle was used
    if (input.bottleId && input.quantityUsedMl) {
      await supabase.from('ipm_stock_movements').insert({
        org_id: orgId,
        bottle_id: input.bottleId,
        movement_type: 'use',
        quantity_ml: -input.quantityUsedMl,
        notes: `Used for batch treatment`,
        created_by: user.id,
      });
    }

    logInfo('Batch health event logged', {
      logId: data.id,
      batchId: input.batchId,
      eventType: input.eventType
    });

    revalidatePath(`/production/batches/${input.batchId}`);
    revalidatePath('/plant-health');
    revalidatePath('/production');

    return { success: true, data: { logId: data.id } };
  } catch (error) {
    logError('Error in logBatchHealthEvent', { error: String(error) });
    return { success: false, error: 'Failed to log health event' };
  }
}

// ============================================================================
// Log Treatment (simplified wrapper)
// ============================================================================

export async function logTreatment(
  batchId: string,
  productName: string,
  rate: number,
  rateUnit: string,
  options?: {
    ipmProductId?: string;
    method?: string;
    weatherConditions?: string;
    reasonForUse?: string;
    notes?: string;
  }
): Promise<ActionResult<{ logId: string }>> {
  return logBatchHealthEvent({
    batchId,
    eventType: 'treatment',
    productName,
    rate,
    rateUnit,
    ...options,
  });
}

// ============================================================================
// Log Fertilizer (simplified wrapper)
// ============================================================================

export async function logFertilizer(
  batchId: string,
  fertilizerName: string,
  rate: number,
  rateUnit: string,
  options?: {
    fertilizerComposition?: string;
    method?: string;
    notes?: string;
  }
): Promise<ActionResult<{ logId: string }>> {
  return logBatchHealthEvent({
    batchId,
    eventType: 'fertilizer',
    productName: fertilizerName,
    rate,
    rateUnit,
    ...options,
  });
}

// ============================================================================
// Log Measurement (simplified wrapper)
// ============================================================================

export async function logMeasurement(
  batchId: string,
  ec?: number,
  ph?: number,
  notes?: string
): Promise<ActionResult<{ logId: string }>> {
  if (!ec && !ph) {
    return { success: false, error: 'At least one measurement (EC or pH) is required' };
  }

  return logBatchHealthEvent({
    batchId,
    eventType: 'measurement',
    ecReading: ec,
    phReading: ph,
    notes,
  });
}

// ============================================================================
// Log Irrigation (simplified wrapper)
// ============================================================================

export async function logIrrigation(
  batchId: string,
  method: string,
  notes?: string
): Promise<ActionResult<{ logId: string }>> {
  return logBatchHealthEvent({
    batchId,
    eventType: 'irrigation',
    method,
    notes,
  });
}

// ============================================================================
// Log Pruning (simplified wrapper)
// ============================================================================

export async function logPruning(
  batchId: string,
  notes?: string
): Promise<ActionResult<{ logId: string }>> {
  return logBatchHealthEvent({
    batchId,
    eventType: 'pruning',
    notes,
  });
}

// ============================================================================
// Log Grading (simplified wrapper)
// ============================================================================

export async function logGrading(
  batchId: string,
  notes?: string
): Promise<ActionResult<{ logId: string }>> {
  return logBatchHealthEvent({
    batchId,
    eventType: 'grading',
    notes,
  });
}
