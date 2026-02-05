'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { requireOrgRole, isPermissionError } from '@/server/auth/permissions';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

export type IpmProduct = {
  id: string;
  orgId: string;
  name: string;
  pcsNumber?: string;
  activeIngredient?: string;
  targetPests: string[];
  suggestedRate?: number;
  suggestedRateUnit?: string;
  maxRate?: number;
  harvestIntervalDays?: number;
  reiHours: number;
  useRestriction: 'indoor' | 'outdoor' | 'both';
  applicationMethods: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
};

export type IpmProductInput = {
  name: string;
  pcsNumber?: string;
  activeIngredient?: string;
  targetPests?: string[];
  suggestedRate?: number;
  suggestedRateUnit?: string;
  maxRate?: number;
  harvestIntervalDays?: number;
  reiHours?: number;
  useRestriction?: 'indoor' | 'outdoor' | 'both';
  applicationMethods?: string[];
  notes?: string;
  isActive?: boolean;
};

export type IpmProgram = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  intervalDays: number;
  durationWeeks: number;
  isActive: boolean;
  createdAt: string;
  steps?: IpmProgramStep[];
};

export type IpmProgramStep = {
  id: string;
  programId: string;
  productId: string;
  stepOrder: number;
  weekNumber?: number;
  rate?: number;
  rateUnit?: string;
  method?: string;
  notes?: string;
  product?: IpmProduct;
};

export type IpmProgramInput = {
  name: string;
  description?: string;
  intervalDays?: number;
  durationWeeks?: number;
  scheduleType?: 'interval_based' | 'week_based';
  isActive?: boolean;
  steps: {
    productId: string;
    rate?: number;
    rateUnit?: string;
    method?: string;
    notes?: string;
    weekNumber?: number;
    sortOrder?: number;
  }[];
};

export type IpmAssignment = {
  id: string;
  orgId: string;
  programId: string;
  targetType: 'family' | 'location';
  targetFamily?: string;
  targetLocationId?: string;
  startsAt: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
  program?: IpmProgram;
  location?: { id: string; name: string };
};

export type IpmAssignmentInput = {
  programId: string;
  targetType: 'family' | 'location';
  targetFamily?: string;
  targetLocationId?: string;
  startsAt?: string; // Optional - programs are templates relative to potting date
};

export type IpmSpotTreatment = {
  id: string;
  orgId: string;
  productId: string;
  targetType: 'batch' | 'location';
  targetBatchId?: string;
  targetLocationId?: string;
  applicationsTotal: number;
  applicationsCompleted: number;
  applicationIntervalDays?: number;
  firstApplicationDate: string;
  nextApplicationDate?: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  reason?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  product?: IpmProduct;
  location?: { id: string; name: string };
  batch?: { id: string; batchNumber: string };
};

export type IpmSpotTreatmentInput = {
  productId: string;
  targetType: 'batch' | 'location';
  targetBatchId?: string;
  targetLocationId?: string;
  applicationsTotal?: number;
  applicationIntervalDays?: number;
  firstApplicationDate: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  reason?: string;
};

export type IpmResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// IPM Products CRUD
// ============================================================================

function normalizeProduct(row: any): IpmProduct {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    pcsNumber: row.pcs_number,
    activeIngredient: row.active_ingredient,
    targetPests: row.target_pests || [],
    suggestedRate: row.suggested_rate,
    suggestedRateUnit: row.suggested_rate_unit,
    maxRate: row.max_rate,
    harvestIntervalDays: row.harvest_interval_days,
    reiHours: row.rei_hours ?? 0,
    useRestriction: row.use_restriction || 'both',
    applicationMethods: row.application_methods || ['Foliar Spray'],
    notes: row.notes,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

export async function listIpmProducts(): Promise<IpmResult<IpmProduct[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_products')
      .select('*')
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      console.error('[listIpmProducts] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeProduct) };
  } catch (error) {
    console.error('[listIpmProducts] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getIpmProduct(id: string): Promise<IpmResult<IpmProduct>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_products')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[getIpmProduct] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeProduct(data) };
  } catch (error) {
    console.error('[getIpmProduct] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createIpmProduct(input: IpmProductInput): Promise<IpmResult<IpmProduct>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_products')
      .insert({
        org_id: orgId,
        name: input.name,
        pcs_number: input.pcsNumber,
        active_ingredient: input.activeIngredient,
        target_pests: input.targetPests || [],
        suggested_rate: input.suggestedRate,
        suggested_rate_unit: input.suggestedRateUnit || 'ml/L',
        max_rate: input.maxRate,
        harvest_interval_days: input.harvestIntervalDays,
        rei_hours: input.reiHours ?? 0,
        use_restriction: input.useRestriction || 'both',
        application_methods: input.applicationMethods || ['Foliar Spray'],
        notes: input.notes,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('[createIpmProduct] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true, data: normalizeProduct(data) };
  } catch (error) {
    console.error('[createIpmProduct] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateIpmProduct(
  id: string,
  input: Partial<IpmProductInput>
): Promise<IpmResult<IpmProduct>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.pcsNumber !== undefined) updateData.pcs_number = input.pcsNumber;
    if (input.activeIngredient !== undefined) updateData.active_ingredient = input.activeIngredient;
    if (input.targetPests !== undefined) updateData.target_pests = input.targetPests;
    if (input.suggestedRate !== undefined) updateData.suggested_rate = input.suggestedRate;
    if (input.suggestedRateUnit !== undefined) updateData.suggested_rate_unit = input.suggestedRateUnit;
    if (input.maxRate !== undefined) updateData.max_rate = input.maxRate;
    if (input.harvestIntervalDays !== undefined) updateData.harvest_interval_days = input.harvestIntervalDays;
    if (input.reiHours !== undefined) updateData.rei_hours = input.reiHours;
    if (input.useRestriction !== undefined) updateData.use_restriction = input.useRestriction;
    if (input.applicationMethods !== undefined) updateData.application_methods = input.applicationMethods;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data, error } = await supabase
      .from('ipm_products')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      console.error('[updateIpmProduct] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true, data: normalizeProduct(data) };
  } catch (error) {
    console.error('[updateIpmProduct] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteIpmProduct(id: string): Promise<IpmResult> {
  try {
    // RBAC: Only admin or owner can delete products
    const { orgId } = await requireOrgRole(['admin', 'owner']);
    const { supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_products')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[deleteIpmProduct] delete failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true };
  } catch (error) {
    console.error('[deleteIpmProduct] error', error);
    if (isPermissionError(error)) {
      return { success: false, error: 'You do not have permission to delete products' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// IPM Programs CRUD
// ============================================================================

function normalizeProgram(row: any): IpmProgram {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    intervalDays: row.interval_days,
    durationWeeks: row.duration_weeks,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    steps: row.ipm_program_steps?.map(normalizeStep),
  };
}

function normalizeStep(row: any): IpmProgramStep {
  return {
    id: row.id,
    programId: row.program_id,
    productId: row.product_id,
    stepOrder: row.step_order,
    weekNumber: row.week_number,
    rate: row.rate,
    rateUnit: row.rate_unit,
    method: row.method,
    notes: row.notes,
    product: row.ipm_products ? normalizeProduct(row.ipm_products) : undefined,
  };
}

export async function listIpmPrograms(): Promise<IpmResult<IpmProgram[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_programs')
      .select(`
        *,
        ipm_program_steps (
          *,
          ipm_products (*)
        )
      `)
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      console.error('[listIpmPrograms] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeProgram) };
  } catch (error) {
    console.error('[listIpmPrograms] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getIpmProgram(id: string): Promise<IpmResult<IpmProgram>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_programs')
      .select(`
        *,
        ipm_program_steps (
          *,
          ipm_products (*)
        )
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[getIpmProgram] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeProgram(data) };
  } catch (error) {
    console.error('[getIpmProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createIpmProgram(input: IpmProgramInput): Promise<IpmResult<IpmProgram>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Create program
    const { data: program, error: programError } = await supabase
      .from('ipm_programs')
      .insert({
        org_id: orgId,
        name: input.name,
        description: input.description,
        interval_days: input.intervalDays || 7,
        duration_weeks: input.durationWeeks || 8,
        schedule_type: input.scheduleType || 'interval_based',
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (programError) {
      console.error('[createIpmProgram] program insert failed', programError);
      return { success: false, error: programError.message };
    }

    // Create steps
    if (input.steps && input.steps.length > 0) {
      const stepsToInsert = input.steps.map((step, index) => ({
        program_id: program.id,
        product_id: step.productId,
        step_order: step.sortOrder ?? index + 1,
        week_number: step.weekNumber ?? 0,
        rate: step.rate,
        rate_unit: step.rateUnit,
        method: step.method,
        notes: step.notes,
      }));

      const { error: stepsError } = await supabase
        .from('ipm_program_steps')
        .insert(stepsToInsert);

      if (stepsError) {
        console.error('[createIpmProgram] steps insert failed', stepsError);
        // Clean up the program
        await supabase.from('ipm_programs').delete().eq('id', program.id);
        return { success: false, error: stepsError.message };
      }
    }

    revalidatePath('/plant-health/programs');
    
    // Re-fetch the complete program with steps
    return getIpmProgram(program.id);
  } catch (error) {
    console.error('[createIpmProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateIpmProgram(
  id: string,
  input: Partial<IpmProgramInput>
): Promise<IpmResult<IpmProgram>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.intervalDays !== undefined) updateData.interval_days = input.intervalDays;
    if (input.durationWeeks !== undefined) updateData.duration_weeks = input.durationWeeks;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { error: programError } = await supabase
      .from('ipm_programs')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId);

    if (programError) {
      console.error('[updateIpmProgram] update failed', programError);
      return { success: false, error: programError.message };
    }

    // If steps are provided, replace them
    if (input.steps !== undefined) {
      // Delete existing steps
      await supabase.from('ipm_program_steps').delete().eq('program_id', id);

      // Insert new steps
      if (input.steps.length > 0) {
        const stepsToInsert = input.steps.map((step, index) => ({
          program_id: id,
          product_id: step.productId,
          step_order: step.sortOrder ?? index + 1,
          rate: step.rate,
          rate_unit: step.rateUnit,
          method: step.method,
          week_number: step.weekNumber ?? 0,
          notes: step.notes,
        }));

        const { error: stepsError } = await supabase
          .from('ipm_program_steps')
          .insert(stepsToInsert);

        if (stepsError) {
          console.error('[updateIpmProgram] steps insert failed', stepsError);
          return { success: false, error: stepsError.message };
        }
      }
    }

    revalidatePath('/plant-health/programs');
    return getIpmProgram(id);
  } catch (error) {
    console.error('[updateIpmProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteIpmProgram(id: string): Promise<IpmResult> {
  try {
    // RBAC: Only admin or owner can delete programs
    const { orgId } = await requireOrgRole(['admin', 'owner']);
    const { supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_programs')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[deleteIpmProgram] delete failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/programs');
    return { success: true };
  } catch (error) {
    console.error('[deleteIpmProgram] error', error);
    if (isPermissionError(error)) {
      return { success: false, error: 'You do not have permission to delete programs' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// IPM Assignments
// ============================================================================

function normalizeAssignment(row: any): IpmAssignment {
  return {
    id: row.id,
    orgId: row.org_id,
    programId: row.program_id,
    targetType: row.target_type,
    targetFamily: row.target_family,
    targetLocationId: row.target_location_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    program: row.ipm_programs ? normalizeProgram(row.ipm_programs) : undefined,
    location: row.nursery_locations ? { id: row.nursery_locations.id, name: row.nursery_locations.name } : undefined,
  };
}

export async function listIpmAssignments(filters?: {
  programId?: string;
  locationId?: string;
  family?: string;
  activeOnly?: boolean;
}): Promise<IpmResult<IpmAssignment[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_assignments')
      .select(`
        *,
        ipm_programs (*),
        nursery_locations (id, name)
      `)
      .eq('org_id', orgId)
      .order('starts_at', { ascending: false });

    if (filters?.programId) query = query.eq('program_id', filters.programId);
    if (filters?.locationId) query = query.eq('target_location_id', filters.locationId);
    if (filters?.family) query = query.eq('target_family', filters.family);
    if (filters?.activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;

    if (error) {
      console.error('[listIpmAssignments] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeAssignment) };
  } catch (error) {
    console.error('[listIpmAssignments] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createIpmAssignment(input: IpmAssignmentInput): Promise<IpmResult<IpmAssignment>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // For family assignments, startsAt is optional - tasks are generated per batch potting date
    // For location assignments, we might want a specific start date
    let endsAt: string | null = null;
    
    if (input.startsAt) {
      const { data: program } = await supabase
        .from('ipm_programs')
        .select('duration_weeks')
        .eq('id', input.programId)
        .single();

      if (program) {
        const startsAtDate = new Date(input.startsAt);
        endsAt = new Date(startsAtDate.getTime() + program.duration_weeks * 7 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
      }
    }

    const { data, error } = await supabase
      .from('ipm_assignments')
      .insert({
        org_id: orgId,
        program_id: input.programId,
        target_type: input.targetType,
        target_family: input.targetType === 'family' ? input.targetFamily : null,
        target_location_id: input.targetType === 'location' ? input.targetLocationId : null,
        starts_at: input.startsAt || null,
        ends_at: endsAt,
        is_active: true,
        created_by: user.id,
      })
      .select(`
        *,
        ipm_programs (*),
        nursery_locations (id, name)
      `)
      .single();

    if (error) {
      console.error('[createIpmAssignment] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/programs');
    revalidatePath('/plant-health');
    return { success: true, data: normalizeAssignment(data) };
  } catch (error) {
    console.error('[createIpmAssignment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deactivateIpmAssignment(id: string): Promise<IpmResult> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[deactivateIpmAssignment] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/programs');
    revalidatePath('/plant-health');
    return { success: true };
  } catch (error) {
    console.error('[deactivateIpmAssignment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// IPM Spot Treatments
// ============================================================================

function normalizeSpotTreatment(row: any): IpmSpotTreatment {
  return {
    id: row.id,
    orgId: row.org_id,
    productId: row.product_id,
    targetType: row.target_type,
    targetBatchId: row.target_batch_id,
    targetLocationId: row.target_location_id,
    applicationsTotal: row.applications_total,
    applicationsCompleted: row.applications_completed,
    applicationIntervalDays: row.application_interval_days,
    firstApplicationDate: row.first_application_date,
    nextApplicationDate: row.next_application_date,
    rate: row.rate,
    rateUnit: row.rate_unit,
    method: row.method,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    product: row.ipm_products ? normalizeProduct(row.ipm_products) : undefined,
    location: row.nursery_locations ? { id: row.nursery_locations.id, name: row.nursery_locations.name } : undefined,
    batch: row.batches ? { id: row.batches.id, batchNumber: row.batches.batch_number } : undefined,
  };
}

export async function listIpmSpotTreatments(filters?: {
  locationId?: string;
  batchId?: string;
  status?: string;
}): Promise<IpmResult<IpmSpotTreatment[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_spot_treatments')
      .select(`
        *,
        ipm_products (*),
        nursery_locations (id, name),
        batches (id, batch_number)
      `)
      .eq('org_id', orgId)
      .order('next_application_date', { ascending: true, nullsFirst: false });

    if (filters?.locationId) query = query.eq('target_location_id', filters.locationId);
    if (filters?.batchId) query = query.eq('target_batch_id', filters.batchId);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;

    if (error) {
      console.error('[listIpmSpotTreatments] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeSpotTreatment) };
  } catch (error) {
    console.error('[listIpmSpotTreatments] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createIpmSpotTreatment(input: IpmSpotTreatmentInput): Promise<IpmResult<IpmSpotTreatment>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_spot_treatments')
      .insert({
        org_id: orgId,
        product_id: input.productId,
        target_type: input.targetType,
        target_batch_id: input.targetType === 'batch' ? input.targetBatchId : null,
        target_location_id: input.targetType === 'location' ? input.targetLocationId : null,
        applications_total: input.applicationsTotal ?? 1,
        application_interval_days: input.applicationIntervalDays,
        first_application_date: input.firstApplicationDate,
        rate: input.rate,
        rate_unit: input.rateUnit,
        method: input.method,
        reason: input.reason,
        status: 'scheduled',
        created_by: user.id,
      })
      .select(`
        *,
        ipm_products (*),
        nursery_locations (id, name),
        batches (id, batch_number)
      `)
      .single();

    if (error) {
      console.error('[createIpmSpotTreatment] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health');
    return { success: true, data: normalizeSpotTreatment(data) };
  } catch (error) {
    console.error('[createIpmSpotTreatment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function recordSpotTreatmentApplication(
  spotTreatmentId: string,
  notes?: string
): Promise<IpmResult<IpmSpotTreatment>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get current spot treatment
    const { data: current, error: fetchError } = await supabase
      .from('ipm_spot_treatments')
      .select(`*, ipm_products (*)`)
      .eq('id', spotTreatmentId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Spot treatment not found' };
    }

    const newCompletedCount = current.applications_completed + 1;
    const newStatus = newCompletedCount >= current.applications_total ? 'completed' : 'in_progress';

    // Update spot treatment
    const { data: updated, error: updateError } = await supabase
      .from('ipm_spot_treatments')
      .update({
        applications_completed: newCompletedCount,
        status: newStatus,
      })
      .eq('id', spotTreatmentId)
      .select(`
        *,
        ipm_products (*),
        nursery_locations (id, name),
        batches (id, batch_number)
      `)
      .single();

    if (updateError) {
      console.error('[recordSpotTreatmentApplication] update failed', updateError);
      return { success: false, error: updateError.message };
    }

    // Log to plant_health_logs
    await supabase.from('plant_health_logs').insert({
      org_id: orgId,
      location_id: current.target_location_id,
      batch_id: current.target_batch_id,
      event_type: 'treatment',
      ipm_product_id: current.product_id,
      spot_treatment_id: spotTreatmentId,
      application_number: newCompletedCount,
      product_name: current.ipm_products?.name,
      rate: current.rate,
      unit: current.rate_unit,
      method: current.method,
      recorded_by: user.id,
      notes: notes || `Spot treatment application ${newCompletedCount} of ${current.applications_total}`,
      event_at: new Date().toISOString(),
    });

    revalidatePath('/plant-health');
    return { success: true, data: normalizeSpotTreatment(updated) };
  } catch (error) {
    console.error('[recordSpotTreatmentApplication] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function cancelSpotTreatment(id: string): Promise<IpmResult> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_spot_treatments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[cancelSpotTreatment] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health');
    return { success: true };
  } catch (error) {
    console.error('[cancelSpotTreatment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Dashboard Queries
// ============================================================================

export async function getUpcomingTreatments(days: number = 7): Promise<IpmResult<IpmSpotTreatment[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { data, error } = await supabase
      .from('ipm_spot_treatments')
      .select(`
        *,
        ipm_products (*),
        nursery_locations (id, name),
        batches (id, batch_number)
      `)
      .eq('org_id', orgId)
      .in('status', ['scheduled', 'in_progress'])
      .lte('next_application_date', endDate.toISOString().split('T')[0])
      .order('next_application_date');

    if (error) {
      console.error('[getUpcomingTreatments] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeSpotTreatment) };
  } catch (error) {
    console.error('[getUpcomingTreatments] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getPlantFamilies(): Promise<IpmResult<string[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('plant_varieties')
      .select('family')
      .eq('org_id', orgId)
      .not('family', 'is', null);

    if (error) {
      console.error('[getPlantFamilies] query failed', error);
      return { success: false, error: error.message };
    }

    // Get unique families
    const families = [...new Set((data || []).map(d => d.family).filter(Boolean))].sort();
    return { success: true, data: families as string[] };
  } catch (error) {
    console.error('[getPlantFamilies] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export type LocationBasic = {
  id: string;
  name: string;
  healthStatus?: string;
  restrictedUntil?: string;
};

export async function listLocations(): Promise<IpmResult<LocationBasic[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('nursery_locations')
      .select('id, name, health_status, restricted_until')
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      console.error('[listLocations] query failed', error);
      return { success: false, error: error.message };
    }

    const locations = (data || []).map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      healthStatus: loc.health_status,
      restrictedUntil: loc.restricted_until,
    }));

    return { success: true, data: locations };
  } catch (error) {
    console.error('[listLocations] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

