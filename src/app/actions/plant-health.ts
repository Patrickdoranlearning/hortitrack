'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';

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
  locationId: string;
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

export type PlantHealthResult<T = void> = 
  | { success: true; data?: T; count?: number }
  | { success: false; error: string };

// ============================================================================
// Treatment Actions (Fan-Out Engine)
// ============================================================================

/**
 * THE FAN-OUT ENGINE
 * Applies a treatment to a location and auto-logs it to EVERY batch currently there.
 * This ensures full traceability - each batch has its own treatment record.
 */
export async function applyLocationTreatment(
  input: TreatmentInput
): Promise<PlantHealthResult<{ count: number }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // 1. Find all ACTIVE batches in this location
    // Exclude archived/shipped batches to keep history clean
    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .select('id')
      .eq('location_id', input.locationId)
      .eq('org_id', orgId)
      .not('status', 'in', '("Archived","Shipped")');

    if (batchError) {
      console.error('[applyLocationTreatment] batch lookup failed', batchError);
      return { success: false, error: 'Failed to find batches at this location' };
    }

    if (!batches || batches.length === 0) {
      return { success: false, error: 'No active batches found in this location to treat' };
    }

    const eventAt = new Date().toISOString();

    // 2. Create the "Master" Location Log (The Audit Record)
    const locationLog = {
      org_id: orgId,
      location_id: input.locationId,
      batch_id: null, // Location-level record
      event_type: 'treatment' as const,
      product_name: input.productName,
      rate: input.rate,
      unit: input.unit,
      method: input.method,
      recorded_by: user.id,
      notes: input.notes || `Broadcast treatment. Applied to ${batches.length} batches.`,
      event_at: eventAt,
      // Stock tracking fields
      ipm_product_id: input.ipmProductId || null,
      bottle_id: input.bottleId || null,
      quantity_used_ml: input.quantityUsedMl || null,
    };

    // 3. Create the "Traceability" Logs (One per Batch)
    const batchLogs = batches.map((batch) => ({
      org_id: orgId,
      batch_id: batch.id,
      location_id: input.locationId, // Record WHERE it happened (in case batch moves later)
      event_type: 'treatment' as const,
      product_name: input.productName,
      rate: input.rate,
      unit: input.unit,
      method: input.method,
      recorded_by: user.id,
      notes: `Treated via location broadcast`,
      event_at: eventAt,
      // Stock tracking - link to same bottle used
      ipm_product_id: input.ipmProductId || null,
      bottle_id: input.bottleId || null,
    }));

    // 4. Execute the inserts
    const { error: insertError } = await supabase
      .from('plant_health_logs')
      .insert([locationLog, ...batchLogs]);

    if (insertError) {
      console.error('[applyLocationTreatment] insert failed', insertError);
      return { success: false, error: `Failed to log treatment: ${insertError.message}` };
    }

    // 5. SAFETY LOCK: Set the "Do Not Enter" time if REI > 0
    if (input.reiHours > 0) {
      const unlockDate = new Date();
      unlockDate.setHours(unlockDate.getHours() + input.reiHours);

      const { error: updateError } = await supabase
        .from('nursery_locations')
        .update({
          health_status: 'restricted',
          restricted_until: unlockDate.toISOString(),
        })
        .eq('id', input.locationId)
        .eq('org_id', orgId);

      if (updateError) {
        console.error('[applyLocationTreatment] safety lock failed', updateError);
        // Don't fail the whole operation - treatment was logged successfully
      }
    }

    revalidatePath('/locations');
    revalidatePath('/production');

    return { success: true, data: { count: batches.length } };
  } catch (error) {
    console.error('[applyLocationTreatment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error applying treatment',
    };
  }
}

// ============================================================================
// Measurement Actions
// ============================================================================

/**
 * Log EC/pH measurements for a location
 */
export async function logMeasurement(
  input: MeasurementInput
): Promise<PlantHealthResult<{ logId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    if (!input.ec && !input.ph) {
      return { success: false, error: 'At least one measurement (EC or pH) is required' };
    }

    const { data, error } = await supabase.from('plant_health_logs').insert({
      org_id: orgId,
      location_id: input.locationId,
      batch_id: null,
      event_type: 'measurement' as const,
      ec_reading: input.ec,
      ph_reading: input.ph,
      recorded_by: user.id,
      notes: input.notes,
      photo_url: input.photoUrl,
      event_at: new Date().toISOString(),
    }).select('id').single();

    if (error) {
      console.error('[logMeasurement] insert failed', error);
      return { success: false, error: `Failed to log measurement: ${error.message}` };
    }

    revalidatePath('/locations');
    revalidatePath('/plant-health');
    return { success: true, data: { logId: data.id } };
  } catch (error) {
    console.error('[logMeasurement] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error logging measurement',
    };
  }
}

// ============================================================================
// Location Flagging Actions
// ============================================================================

/**
 * Flag a location as having a health issue (infested, diseased, etc.)
 */
export async function flagLocation(
  input: FlagLocationInput
): Promise<PlantHealthResult<{ logId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // 1. Log the scouting event
    const { data, error: logError } = await supabase.from('plant_health_logs').insert({
      org_id: orgId,
      location_id: input.locationId,
      batch_id: null,
      event_type: 'scout_flag' as const,
      issue_reason: input.issueReason,
      severity: input.severity,
      recorded_by: user.id,
      notes: input.notes,
      photo_url: input.photoUrl,
      affected_batch_ids: input.affectedBatchIds?.length ? input.affectedBatchIds : null,
      event_at: new Date().toISOString(),
    }).select('id').single();

    if (logError) {
      console.error('[flagLocation] log insert failed', logError);
      return { success: false, error: `Failed to log flag: ${logError.message}` };
    }

    // 2. Update location health status
    const { error: updateError } = await supabase
      .from('nursery_locations')
      .update({ health_status: 'infested' })
      .eq('id', input.locationId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('[flagLocation] status update failed', updateError);
      // Don't fail - the log was created successfully
    }

    revalidatePath('/locations');
    revalidatePath('/plant-health');
    return { success: true, data: { logId: data.id } };
  } catch (error) {
    console.error('[flagLocation] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error flagging location',
    };
  }
}

/**
 * Clear a location's health status (mark as clean after treatment/inspection)
 */
export async function clearLocation(
  input: ClearLocationInput
): Promise<PlantHealthResult> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // 1. Log the clearance event
    const { error: logError } = await supabase.from('plant_health_logs').insert({
      org_id: orgId,
      location_id: input.locationId,
      batch_id: null,
      event_type: 'clearance' as const,
      recorded_by: user.id,
      notes: input.notes || 'Location cleared and marked as clean',
      event_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('[clearLocation] log insert failed', logError);
      return { success: false, error: `Failed to log clearance: ${logError.message}` };
    }

    // 2. Clear health status
    const { error: updateError } = await supabase
      .from('nursery_locations')
      .update({
        health_status: 'clean',
        restricted_until: null,
      })
      .eq('id', input.locationId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('[clearLocation] status update failed', updateError);
    }

    revalidatePath('/locations');
    return { success: true };
  } catch (error) {
    console.error('[clearLocation] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error clearing location',
    };
  }
}

// ============================================================================
// Query Actions
// ============================================================================

/**
 * Get plant health logs for a location
 */
export async function getLocationHealthLogs(locationId: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('plant_health_logs')
      .select('*')
      .eq('location_id', locationId)
      .eq('org_id', orgId)
      .order('event_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[getLocationHealthLogs] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[getLocationHealthLogs] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get plant health logs for a specific batch
 */
export async function getBatchHealthLogs(batchId: string) {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('plant_health_logs')
      .select('*')
      .eq('batch_id', batchId)
      .eq('org_id', orgId)
      .order('event_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[getBatchHealthLogs] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[getBatchHealthLogs] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Scout Wizard Actions
// ============================================================================

/**
 * Create a scout log entry (unified issue or reading)
 * Returns the logId for linking to treatments
 */
export async function createScoutLog(
  input: ScoutLogInput
): Promise<PlantHealthResult<{ logId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Need at least a location or a batch
    if (!input.locationId && !input.batchId && (!input.affectedBatchIds || input.affectedBatchIds.length === 0)) {
      return { success: false, error: 'Either a location or batch is required' };
    }

    if (input.logType === 'issue') {
      if (!input.issueReason) {
        return { success: false, error: 'Issue reason is required' };
      }

      const { data, error } = await supabase.from('plant_health_logs').insert({
        org_id: orgId,
        location_id: input.locationId || null,
        batch_id: input.batchId || null,
        event_type: 'scout_flag' as const,
        issue_reason: input.issueReason,
        severity: input.severity || 'medium',
        recorded_by: user.id,
        notes: input.notes,
        photo_url: input.photoUrl,
        affected_batch_ids: input.affectedBatchIds?.length ? input.affectedBatchIds : null,
        event_at: new Date().toISOString(),
      }).select('id').single();

      if (error) {
        console.error('[createScoutLog] issue insert failed', error);
        return { success: false, error: error.message };
      }

      // Update location health status if medium or critical (only if location provided)
      if (input.locationId && (input.severity === 'medium' || input.severity === 'critical')) {
        await supabase
          .from('nursery_locations')
          .update({ health_status: 'infested' })
          .eq('id', input.locationId)
          .eq('org_id', orgId);
      }

      revalidatePath('/locations');
      revalidatePath('/plant-health');
      return { success: true, data: { logId: data.id } };
    } else {
      // Reading
      if (!input.ec && !input.ph) {
        return { success: false, error: 'At least one measurement (EC or pH) is required' };
      }

      const { data, error } = await supabase.from('plant_health_logs').insert({
        org_id: orgId,
        location_id: input.locationId || null,
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
        console.error('[createScoutLog] measurement insert failed', error);
        return { success: false, error: error.message };
      }

      revalidatePath('/locations');
      revalidatePath('/plant-health');
      return { success: true, data: { logId: data.id } };
    }
  } catch (error) {
    console.error('[createScoutLog] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Schedule a treatment (chemical, mechanical, or feeding)
 * Called from the scout wizard step 3
 */
export async function scheduleTreatment(
  input: ScheduleTreatmentInput
): Promise<PlantHealthResult<{ treatmentId: string }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Insert into ipm_spot_treatments table (extended for all types)
    const insertData: Record<string, any> = {
      org_id: orgId,
      target_type: 'location',
      target_location_id: input.locationId,
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
      console.error('[scheduleTreatment] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health');
    return { success: true, data: { treatmentId: data.id } };
  } catch (error) {
    console.error('[scheduleTreatment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

