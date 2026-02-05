'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { logError, logInfo } from '@/lib/log';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid ID format');

const treatmentInputSchema = z.object({
  locationId: uuidSchema,
  productName: z.string().min(1, 'Product name is required').max(200, 'Product name too long'),
  rate: z.number().positive('Rate must be positive'),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long'),
  method: z.string().min(1, 'Method is required').max(100, 'Method too long'),
  reiHours: z.number().min(0, 'REI hours must be non-negative'),
  notes: z.string().max(1000, 'Notes too long').optional(),
  ipmProductId: uuidSchema.optional(),
  bottleId: uuidSchema.optional(),
  quantityUsedMl: z.number().positive('Quantity must be positive').optional(),
});

const measurementInputSchema = z.object({
  locationId: uuidSchema,
  ec: z.number().min(0, 'EC must be non-negative').max(10, 'EC must be 10 or less').optional(),
  ph: z.number().min(0, 'pH must be non-negative').max(14, 'pH must be 14 or less').optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  photoUrl: z.string().url('Invalid photo URL').optional(),
}).refine(
  (data) => data.ec !== undefined || data.ph !== undefined,
  'At least one measurement (EC or pH) is required'
);

const flagLocationInputSchema = z.object({
  locationId: uuidSchema,
  issueReason: z.string().min(1, 'Issue reason is required').max(500, 'Issue reason too long'),
  severity: z.enum(['low', 'medium', 'critical'], { errorMap: () => ({ message: 'Invalid severity level' }) }),
  notes: z.string().max(1000, 'Notes too long').optional(),
  photoUrl: z.string().url('Invalid photo URL').optional(),
  affectedBatchIds: z.array(uuidSchema).optional(),
});

const scoutLogInputSchema = z.object({
  locationId: uuidSchema.optional(),
  batchId: uuidSchema.optional(),
  logType: z.enum(['issue', 'reading'], { errorMap: () => ({ message: 'Invalid log type' }) }),
  issueReason: z.string().min(1, 'Issue reason is required').max(500, 'Issue reason too long').optional(),
  severity: z.enum(['low', 'medium', 'critical']).optional(),
  ec: z.number().min(0).max(10).optional(),
  ph: z.number().min(0).max(14).optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
  photoUrl: z.string().url('Invalid photo URL').optional(),
  affectedBatchIds: z.array(uuidSchema).optional(),
}).refine(
  (data) => data.locationId || data.batchId,
  'Either locationId or batchId is required'
).refine(
  (data) => {
    if (data.logType === 'issue') {
      return data.issueReason && data.issueReason.length > 0 && data.severity;
    }
    return true;
  },
  'Issue logs require issueReason and severity'
).refine(
  (data) => {
    if (data.logType === 'reading') {
      return data.ec !== undefined || data.ph !== undefined;
    }
    return true;
  },
  'Reading logs require at least one measurement (EC or pH)'
);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const scheduleTreatmentInputSchema = z.object({
  locationId: uuidSchema.optional(),
  batchId: uuidSchema.optional(),
  treatmentType: z.enum(['chemical', 'mechanical', 'feeding'], { errorMap: () => ({ message: 'Invalid treatment type' }) }),
  productId: uuidSchema.optional(),
  productName: z.string().min(1).max(200).optional(),
  rate: z.number().positive('Rate must be positive').optional(),
  rateUnit: z.string().max(50).optional(),
  method: z.string().max(100).optional(),
  applicationsTotal: z.number().int().positive('Applications must be positive').optional(),
  applicationIntervalDays: z.number().int().positive('Interval must be positive').optional(),
  mechanicalAction: z.enum(['trimming', 'spacing', 'weeding', 'removing']).optional(),
  fertilizerName: z.string().max(200).optional(),
  fertilizerRate: z.number().positive().optional(),
  fertilizerUnit: z.string().max(50).optional(),
  scheduledDate: z.string().regex(dateRegex, 'Invalid date format (use YYYY-MM-DD)'),
  notes: z.string().max(1000, 'Notes too long').optional(),
  triggeredByLogId: uuidSchema.optional(),
}).refine(
  (data) => data.locationId || data.batchId,
  'Either locationId or batchId is required'
).refine(
  (data) => {
    if (data.treatmentType === 'chemical') {
      return data.productId || data.productName;
    }
    return true;
  },
  'Chemical treatments require a product'
).refine(
  (data) => {
    if (data.treatmentType === 'mechanical') {
      return data.mechanicalAction;
    }
    return true;
  },
  'Mechanical treatments require an action'
).refine(
  (data) => {
    if (data.treatmentType === 'feeding') {
      return data.fertilizerName;
    }
    return true;
  },
  'Feeding treatments require a fertilizer name'
);

const clearLocationInputSchema = z.object({
  locationId: uuidSchema,
  notes: z.string().max(1000, 'Notes too long').optional(),
});

const listScoutLogsInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional(),
  locationId: uuidSchema.optional(),
  logType: z.enum(['issue', 'reading']).optional(),
});

// ============================================================================
// Types
// ============================================================================

export type TreatmentInput = {
  locationId: string;
  productName: string;
  rate: number;
  unit: string;
  method: string;
  reiHours: number; // Safety Re-entry Interval in hours
  notes?: string;
  // Stock tracking fields (optional)
  ipmProductId?: string;
  bottleId?: string;
  quantityUsedMl?: number;
};

export type MeasurementInput = {
  locationId: string;
  batchId?: string;
  ec?: number;
  ph?: number;
  notes?: string;
  photoUrl?: string;
};

export type FlagLocationInput = {
  locationId: string;
  issueReason: string;
  severity: 'low' | 'medium' | 'critical';
  notes?: string;
  photoUrl?: string;
  affectedBatchIds?: string[];
};

// Scout Wizard Combined Input
export type ScoutLogInput = {
  locationId?: string; // Optional - can log against batch only
  batchId?: string;    // Optional - specific batch
  logType: 'issue' | 'reading';
  // Issue fields
  issueReason?: string;
  severity?: 'low' | 'medium' | 'critical';
  // Reading fields
  ec?: number;
  ph?: number;
  // Common fields
  notes?: string;
  photoUrl?: string;
  affectedBatchIds?: string[];
};

export type ScheduleTreatmentInput = {
  locationId?: string; // Optional - either locationId or batchId required
  batchId?: string;    // Optional - for batch-only treatments
  treatmentType: 'chemical' | 'mechanical' | 'feeding';
  // Chemical
  productId?: string;
  productName?: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  applicationsTotal?: number;
  applicationIntervalDays?: number;
  // Mechanical
  mechanicalAction?: 'trimming' | 'spacing' | 'weeding' | 'removing';
  // Feeding
  fertilizerName?: string;
  fertilizerRate?: number;
  fertilizerUnit?: string;
  // Common
  scheduledDate: string;
  notes?: string;
  // Link to triggering health log
  triggeredByLogId?: string;
};

export type ClearLocationInput = {
  locationId: string;
  notes?: string;
};

// Scout Log Entry type for listing logs
export type ScoutLogEntry = {
  id: string;
  logType: 'issue' | 'reading';
  locationId: string | null;
  locationName: string | null;
  batchId: string | null;
  batchNumber: string | null;
  issueReason: string | null;
  severity: 'low' | 'medium' | 'critical' | null;
  ecReading: number | null;
  phReading: number | null;
  notes: string | null;
  photoUrl: string | null;
  recordedBy: string;
  recordedByName: string | null;
  eventAt: string;
};

export type ListScoutLogsInput = {
  limit?: number;
  offset?: number;
  locationId?: string;
  logType?: 'issue' | 'reading';
};

export type PlantHealthResult<T = void> =
  | { success: true; data?: T; count?: number }
  | { success: false; error: string };

// ============================================================================
// Treatment Actions (Atomic RPC)
// ============================================================================

/**
 * Applies a treatment to a location atomically (Fan-out via RPC)
 */
export async function applyLocationTreatment(
  input: TreatmentInput
): Promise<PlantHealthResult<{ count: number }>> {
  // Validate input
  const validation = treatmentInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data: rpcResult, error: rpcError } = await supabase.rpc('apply_location_treatment_atomic', {
      p_org_id: orgId,
      p_user_id: user.id,
      p_location_id: input.locationId,
      p_product_name: input.productName,
      p_rate: input.rate,
      p_unit: input.unit,
      p_method: input.method,
      p_rei_hours: input.reiHours,
      p_notes: input.notes,
      p_ipm_product_id: input.ipmProductId || null,
      p_bottle_id: input.bottleId || null,
      p_quantity_used_ml: input.quantityUsedMl || null
    });

    if (rpcError) {
      logError('Failed to apply treatment RPC', { error: rpcError.message, input });
      return { success: false, error: rpcError.message };
    }

    revalidatePath('/locations');
    revalidatePath('/production');
    revalidatePath('/plant-health');

    return { success: true, data: { count: rpcResult.batch_count } };
  } catch (error) {
    logError('Error in applyLocationTreatment action', { error: String(error) });
    return { success: false, error: 'Failed to apply treatment' };
  }
}

// ============================================================================
// Measurement Actions
// ============================================================================

export async function logMeasurement(
  input: MeasurementInput
): Promise<PlantHealthResult<{ logId: string }>> {
  // Validate input
  const validation = measurementInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase.from('plant_health_logs').insert({
      org_id: orgId,
      location_id: input.locationId,
      batch_id: input.batchId || null,
      event_type: 'measurement' as const,
      ec_reading: input.ec,
      ph_reading: input.ph,
      recorded_by: user.id,
      notes: input.notes,
      photo_url: input.photoUrl,
      event_at: new Date().toISOString(),
    }).select('id').single();

    if (error) {
      logError('Failed to log measurement', { error: error.message, input });
      return { success: false, error: `Failed to log measurement: ${error.message}` };
    }

    revalidatePath('/locations');
    revalidatePath('/plant-health');
    return { success: true, data: { logId: data.id } };
  } catch (error) {
    logError('Error in logMeasurement action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ============================================================================
// Location Flagging Actions (Atomic RPC)
// ============================================================================

export async function flagLocation(
  input: FlagLocationInput
): Promise<PlantHealthResult<{ logId: string }>> {
  // Validate input
  const validation = flagLocationInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data: rpcResult, error: rpcError } = await supabase.rpc('flag_location_atomic', {
      p_org_id: orgId,
      p_user_id: user.id,
      p_location_id: input.locationId,
      p_issue_reason: input.issueReason,
      p_severity: input.severity,
      p_notes: input.notes,
      p_photo_url: input.photoUrl,
      p_affected_batch_ids: input.affectedBatchIds || null
    });

    if (rpcError) {
      logError('Failed to flag location RPC', { error: rpcError.message, input });
      return { success: false, error: rpcError.message };
    }

    // Trigger critical alert if severity is critical
    if (input.severity === 'critical') {
      logInfo('[CRITICAL ALERT] Plant health issue flagged', {
        locationId: input.locationId,
        issueReason: input.issueReason,
        logId: rpcResult.log_id,
        orgId,
        userId: user.id,
        alertType: 'critical_plant_health_issue',
      });

      // Create audit entry for critical alert (using plant_health_logs audit trail)
      // Future enhancement: Insert into notifications table for in-app alerts
      // Future enhancement: Trigger email/SMS via webhook or edge function
    }

    revalidatePath('/locations');
    revalidatePath('/plant-health');
    return { success: true, data: { logId: rpcResult.log_id } };
  } catch (error) {
    logError('Error in flagLocation action', { error: String(error) });
    return { success: false, error: 'Failed to flag location' };
  }
}

export async function clearLocation(
  input: ClearLocationInput
): Promise<PlantHealthResult> {
  // Validate input
  const validation = clearLocationInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { error: rpcError } = await supabase.rpc('clear_location_atomic', {
      p_org_id: orgId,
      p_user_id: user.id,
      p_location_id: input.locationId,
      p_notes: input.notes
    });

    if (rpcError) {
      logError('Failed to clear location RPC', { error: rpcError.message, input });
      return { success: false, error: rpcError.message };
    }

    revalidatePath('/locations');
    revalidatePath('/plant-health');
    return { success: true };
  } catch (error) {
    logError('Error in clearLocation action', { error: String(error) });
    return { success: false, error: 'Failed to clear location' };
  }
}

// ============================================================================
// Scout Wizard Actions (Refactored for consistency)
// ============================================================================

export async function createScoutLog(
  input: ScoutLogInput
): Promise<PlantHealthResult<{ logId: string }>> {
  // Validate input
  const validation = scoutLogInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    let locationId = input.locationId;

    // If no locationId but batchId is provided, look up the batch's location
    if (!locationId && input.batchId) {
      const { supabase } = await getUserAndOrg();
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('location_id')
        .eq('id', input.batchId)
        .single();

      if (batchError || !batch?.location_id) {
        logError('Failed to get batch location', { error: batchError?.message, batchId: input.batchId });
        return { success: false, error: 'Could not find batch location' };
      }
      locationId = batch.location_id;
    }

    if (!locationId) {
      return { success: false, error: 'Location is required' };
    }

    if (input.logType === 'issue') {
      // Already validated that issue logs have required fields
      return flagLocation({
        locationId,
        issueReason: input.issueReason!,
        severity: input.severity!,
        notes: input.notes,
        photoUrl: input.photoUrl,
        affectedBatchIds: input.affectedBatchIds || (input.batchId ? [input.batchId] : undefined)
      });
    } else {
      // Reading log - already validated that at least one measurement exists
      return logMeasurement({
        locationId,
        batchId: input.batchId,
        ec: input.ec,
        ph: input.ph,
        notes: input.notes,
        photoUrl: input.photoUrl
      });
    }
  } catch (error) {
    logError('Error in createScoutLog action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function scheduleTreatment(
  input: ScheduleTreatmentInput
): Promise<PlantHealthResult<{ treatmentId: string }>> {
  // Validate input
  const validation = scheduleTreatmentInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Determine target type based on which ID is provided
    const targetType = input.locationId ? 'location' : 'batch';

    const insertData: Record<string, unknown> = {
      org_id: orgId,
      target_type: targetType,
      target_location_id: input.locationId || null,
      target_batch_id: input.batchId || null,
      treatment_type: input.treatmentType,
      first_application_date: input.scheduledDate,
      applications_total: input.applicationsTotal || 1,
      application_interval_days: input.applicationIntervalDays,
      status: 'scheduled',
      reason: input.notes,
      created_by: user.id,
      triggered_by_log_id: input.triggeredByLogId,
    };

    if (input.treatmentType === 'chemical') {
      insertData.product_id = input.productId;
      insertData.rate = input.rate;
      insertData.rate_unit = input.rateUnit;
      insertData.method = input.method;
    } else if (input.treatmentType === 'mechanical') {
      insertData.mechanical_action = input.mechanicalAction;
    } else if (input.treatmentType === 'feeding') {
      insertData.fertilizer_name = input.fertilizerName;
      insertData.fertilizer_rate = input.fertilizerRate;
      insertData.fertilizer_unit = input.fertilizerUnit;
    }

    const { data, error } = await supabase
      .from('ipm_spot_treatments')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      logError('Failed to schedule treatment', { error: error.message, input });
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health');
    return { success: true, data: { treatmentId: data.id } };
  } catch (error) {
    logError('Error in scheduleTreatment action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// ============================================================================
// Scout Log Listing Actions
// ============================================================================

/**
 * Lists scout logs (health logs) with pagination and optional filters
 */
export async function listScoutLogs(
  input: ListScoutLogsInput = {}
): Promise<PlantHealthResult<{ logs: ScoutLogEntry[]; total: number }>> {
  // Validate input
  const validation = listScoutLogsInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message };
  }

  try {
    const { orgId, supabase } = await getUserAndOrg();
    const { limit = 20, offset = 0, locationId, logType } = input;

    // Build the query
    let query = supabase
      .from('plant_health_logs')
      .select(`
        id,
        event_type,
        location_id,
        locations!left(name),
        batch_id,
        batches!left(batch_number),
        issue_reason,
        severity,
        ec_reading,
        ph_reading,
        notes,
        photo_url,
        recorded_by,
        profiles!plant_health_logs_recorded_by_fkey(full_name),
        event_at
      `, { count: 'exact' })
      .eq('org_id', orgId)
      .order('event_at', { ascending: false });

    // Apply filters
    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    if (logType) {
      const eventType = logType === 'issue' ? 'issue_flagged' : 'measurement';
      query = query.eq('event_type', eventType);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError('Failed to list scout logs', { error: error.message, input });
      return { success: false, error: `Failed to fetch logs: ${error.message}` };
    }

    // Transform the data to match ScoutLogEntry type
    const logs: ScoutLogEntry[] = (data || []).map((row: Record<string, unknown>) => {
      const locations = row.locations as { name: string } | null;
      const batches = row.batches as { batch_number: string } | null;
      const profiles = row.profiles as { full_name: string } | null;

      return {
        id: row.id as string,
        logType: row.event_type === 'measurement' ? 'reading' : 'issue',
        locationId: row.location_id as string | null,
        locationName: locations?.name || null,
        batchId: row.batch_id as string | null,
        batchNumber: batches?.batch_number || null,
        issueReason: row.issue_reason as string | null,
        severity: row.severity as 'low' | 'medium' | 'critical' | null,
        ecReading: row.ec_reading as number | null,
        phReading: row.ph_reading as number | null,
        notes: row.notes as string | null,
        photoUrl: row.photo_url as string | null,
        recordedBy: row.recorded_by as string,
        recordedByName: profiles?.full_name || null,
        eventAt: row.event_at as string,
      };
    });

    return { success: true, data: { logs, total: count || 0 } };
  } catch (error) {
    logError('Error in listScoutLogs action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Gets health logs for a specific location
 */
export async function getLocationHealthLogs(
  locationId: string,
  limit: number = 20
): Promise<PlantHealthResult<Array<{
  id: string;
  event_type: string;
  event_at: string;
  product_name?: string;
  rate?: number;
  unit?: string;
  method?: string;
  ec_reading?: number;
  ph_reading?: number;
  issue_reason?: string;
  severity?: string;
  notes?: string;
}>>> {
  // Validate input
  const locationValidation = uuidSchema.safeParse(locationId);
  if (!locationValidation.success) {
    return { success: false, error: 'Invalid location ID format' };
  }

  const limitValidation = z.number().int().positive().max(100).safeParse(limit);
  if (!limitValidation.success) {
    return { success: false, error: 'Limit must be a positive integer up to 100' };
  }

  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('plant_health_logs')
      .select(`
        id,
        event_type,
        event_at,
        product_name,
        rate,
        unit,
        method,
        ec_reading,
        ph_reading,
        issue_reason,
        severity,
        notes
      `)
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .order('event_at', { ascending: false })
      .limit(limit);

    if (error) {
      logError('Failed to get location health logs', { error: error.message, locationId });
      return { success: false, error: `Failed to fetch logs: ${error.message}` };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logError('Error in getLocationHealthLogs action', { error: String(error) });
    return { success: false, error: 'An unexpected error occurred' };
  }
}
