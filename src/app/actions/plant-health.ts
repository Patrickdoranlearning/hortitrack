'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import { logError, logInfo } from '@/lib/log';

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
// Treatment Actions (Atomic RPC)
// ============================================================================

/**
 * Applies a treatment to a location atomically (Fan-out via RPC)
 */
export async function applyLocationTreatment(
  input: TreatmentInput
): Promise<PlantHealthResult<{ count: number }>> {
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
  try {
    if (input.logType === 'issue') {
      return flagLocation({
        locationId: input.locationId || '',
        issueReason: input.issueReason || '',
        severity: input.severity || 'medium',
        notes: input.notes,
        photoUrl: input.photoUrl,
        affectedBatchIds: input.affectedBatchIds
      });
    } else {
      return logMeasurement({
        locationId: input.locationId || '',
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
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

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
