'use server';

import { getUserAndOrg } from '@/server/auth/org';
import { requireOrgRole, isPermissionError } from '@/server/auth/permissions';
import { revalidatePath } from 'next/cache';
import type {
  IpmRemedialProgram,
  IpmRemedialStep,
  IpmRemedialApplication,
  IpmRemedialApplicationStep,
  IpmRemedialProgramInput,
  IpmRemedialResult,
  ApplyRemedialProgramInput,
  RemedialProgramFilters,
  RemedialApplicationFilters,
} from '@/types/ipm-remedial';
import type { IpmProduct } from '@/app/actions/ipm';

// ============================================================================
// Normalization Functions
// ============================================================================

function normalizeProduct(row: Record<string, unknown>): IpmProduct {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    pcsNumber: row.pcs_number as string | undefined,
    activeIngredient: row.active_ingredient as string | undefined,
    targetPests: (row.target_pests as string[]) || [],
    suggestedRate: row.suggested_rate as number | undefined,
    suggestedRateUnit: row.suggested_rate_unit as string | undefined,
    maxRate: row.max_rate as number | undefined,
    harvestIntervalDays: row.harvest_interval_days as number | undefined,
    reiHours: (row.rei_hours as number) ?? 0,
    useRestriction: (row.use_restriction as 'indoor' | 'outdoor' | 'both') || 'both',
    applicationMethods: (row.application_methods as string[]) || ['Foliar Spray'],
    notes: row.notes as string | undefined,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: row.created_at as string,
  };
}

function normalizeStep(row: Record<string, unknown>): IpmRemedialStep {
  return {
    id: row.id as string,
    programId: row.program_id as string,
    stepOrder: row.step_order as number,
    dayOffset: row.day_offset as number,
    productId: row.product_id as string,
    rate: row.rate as number | undefined,
    rateUnit: row.rate_unit as string | undefined,
    method: row.method as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    product: row.ipm_products ? normalizeProduct(row.ipm_products as Record<string, unknown>) : undefined,
  };
}

function normalizeProgram(row: Record<string, unknown>): IpmRemedialProgram {
  const steps = row.ipm_remedial_steps as Record<string, unknown>[] | undefined;
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    targetPestDisease: row.target_pest_disease as string,
    severityApplicability: (row.severity_applicability as string[]) || ['medium', 'critical'],
    treatmentDurationDays: row.treatment_duration_days as number,
    treatmentUrgency: (row.treatment_urgency as 'immediate' | 'standard') || 'standard',
    isActive: (row.is_active as boolean) ?? true,
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    steps: steps?.map(normalizeStep),
    stepCount: row.step_count as number | undefined,
    productNames: row.product_names as string[] | undefined,
  };
}

function normalizeApplicationStep(row: Record<string, unknown>): IpmRemedialApplicationStep {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    stepId: row.step_id as string,
    dueDate: row.due_date as string,
    completedAt: row.completed_at as string | undefined,
    completedBy: row.completed_by as string | undefined,
    plantHealthLogId: row.plant_health_log_id as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
    step: row.ipm_remedial_steps ? normalizeStep(row.ipm_remedial_steps as Record<string, unknown>) : undefined,
  };
}

function normalizeApplication(row: Record<string, unknown>): IpmRemedialApplication {
  const applicationSteps = row.ipm_remedial_application_steps as Record<string, unknown>[] | undefined;
  const batchData = row.batches as Record<string, unknown> | undefined;
  const locationData = row.nursery_locations as Record<string, unknown> | undefined;
  const programData = row.ipm_remedial_programs as Record<string, unknown> | undefined;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    programId: row.program_id as string,
    triggeredByLogId: row.triggered_by_log_id as string | undefined,
    targetType: row.target_type as 'batch' | 'location',
    targetBatchId: row.target_batch_id as string | undefined,
    targetLocationId: row.target_location_id as string | undefined,
    startedAt: row.started_at as string,
    expectedCompletion: row.expected_completion as string | undefined,
    status: row.status as 'active' | 'completed' | 'cancelled',
    stepsCompleted: row.steps_completed as number,
    totalSteps: row.total_steps as number,
    notes: row.notes as string | undefined,
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    program: programData ? normalizeProgram(programData) : undefined,
    batch: batchData ? { id: batchData.id as string, batchNumber: batchData.batch_number as string } : undefined,
    location: locationData ? { id: locationData.id as string, name: locationData.name as string } : undefined,
    applicationSteps: applicationSteps?.map(normalizeApplicationStep),
  };
}

// ============================================================================
// Remedial Programs CRUD
// ============================================================================

/**
 * List all remedial programs for the org
 */
export async function listRemedialPrograms(
  filters?: RemedialProgramFilters
): Promise<IpmRemedialResult<IpmRemedialProgram[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_remedial_programs')
      .select(`
        *,
        ipm_remedial_steps (
          *,
          ipm_products (*)
        )
      `)
      .eq('org_id', orgId)
      .order('target_pest_disease')
      .order('name');

    if (filters?.pest) {
      query = query.eq('target_pest_disease', filters.pest);
    }
    if (filters?.urgency) {
      query = query.eq('treatment_urgency', filters.urgency);
    }
    if (filters?.activeOnly !== false) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[listRemedialPrograms] query failed', error);
      return { success: false, error: error.message };
    }

    let programs = (data || []).map((row) => normalizeProgram(row as Record<string, unknown>));

    // Filter by severity if specified
    if (filters?.severity) {
      programs = programs.filter((p) =>
        p.severityApplicability.includes(filters.severity!)
      );
    }

    return { success: true, data: programs };
  } catch (error) {
    console.error('[listRemedialPrograms] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get remedial programs matching a specific pest/disease and severity
 * Used by Scout Wizard to suggest programs
 */
export async function getRemedialProgramsForPest(
  pest: string,
  severity?: string
): Promise<IpmRemedialResult<IpmRemedialProgram[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_remedial_programs')
      .select(`
        *,
        ipm_remedial_steps (
          *,
          ipm_products (*)
        )
      `)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .ilike('target_pest_disease', `%${pest}%`)
      .order('treatment_urgency', { ascending: false }) // 'immediate' before 'standard'
      .order('name');

    if (error) {
      console.error('[getRemedialProgramsForPest] query failed', error);
      return { success: false, error: error.message };
    }

    let programs = (data || []).map((row) => normalizeProgram(row as Record<string, unknown>));

    // Filter by severity if specified
    if (severity) {
      programs = programs.filter((p) =>
        p.severityApplicability.includes(severity)
      );
    }

    return { success: true, data: programs };
  } catch (error) {
    console.error('[getRemedialProgramsForPest] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a single remedial program by ID
 */
export async function getRemedialProgram(id: string): Promise<IpmRemedialResult<IpmRemedialProgram>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_remedial_programs')
      .select(`
        *,
        ipm_remedial_steps (
          *,
          ipm_products (*)
        )
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[getRemedialProgram] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeProgram(data as Record<string, unknown>) };
  } catch (error) {
    console.error('[getRemedialProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new remedial program with steps
 */
export async function createRemedialProgram(
  input: IpmRemedialProgramInput
): Promise<IpmRemedialResult<IpmRemedialProgram>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Create program
    const { data: program, error: programError } = await supabase
      .from('ipm_remedial_programs')
      .insert({
        org_id: orgId,
        name: input.name,
        description: input.description,
        target_pest_disease: input.targetPestDisease,
        severity_applicability: input.severityApplicability || ['medium', 'critical'],
        treatment_duration_days: input.treatmentDurationDays || 14,
        treatment_urgency: input.treatmentUrgency || 'standard',
        is_active: input.isActive ?? true,
        created_by: user.id,
      })
      .select()
      .single();

    if (programError) {
      console.error('[createRemedialProgram] program insert failed', programError);
      return { success: false, error: programError.message };
    }

    // Create steps
    if (input.steps && input.steps.length > 0) {
      const stepsToInsert = input.steps.map((step, index) => ({
        program_id: program.id,
        step_order: index + 1,
        day_offset: step.dayOffset,
        product_id: step.productId,
        rate: step.rate,
        rate_unit: step.rateUnit || 'ml/L',
        method: step.method || 'Foliar Spray',
        notes: step.notes,
      }));

      const { error: stepsError } = await supabase
        .from('ipm_remedial_steps')
        .insert(stepsToInsert);

      if (stepsError) {
        console.error('[createRemedialProgram] steps insert failed', stepsError);
        // Clean up the program
        await supabase.from('ipm_remedial_programs').delete().eq('id', program.id);
        return { success: false, error: stepsError.message };
      }
    }

    revalidatePath('/plant-health/programs');

    // Re-fetch the complete program with steps
    return getRemedialProgram(program.id);
  } catch (error) {
    console.error('[createRemedialProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update an existing remedial program
 */
export async function updateRemedialProgram(
  id: string,
  input: Partial<IpmRemedialProgramInput>
): Promise<IpmRemedialResult<IpmRemedialProgram>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.targetPestDisease !== undefined) updateData.target_pest_disease = input.targetPestDisease;
    if (input.severityApplicability !== undefined) updateData.severity_applicability = input.severityApplicability;
    if (input.treatmentDurationDays !== undefined) updateData.treatment_duration_days = input.treatmentDurationDays;
    if (input.treatmentUrgency !== undefined) updateData.treatment_urgency = input.treatmentUrgency;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { error: programError } = await supabase
      .from('ipm_remedial_programs')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId);

    if (programError) {
      console.error('[updateRemedialProgram] update failed', programError);
      return { success: false, error: programError.message };
    }

    // If steps are provided, replace them
    if (input.steps !== undefined) {
      // Delete existing steps
      await supabase.from('ipm_remedial_steps').delete().eq('program_id', id);

      // Insert new steps
      if (input.steps.length > 0) {
        const stepsToInsert = input.steps.map((step, index) => ({
          program_id: id,
          step_order: index + 1,
          day_offset: step.dayOffset,
          product_id: step.productId,
          rate: step.rate,
          rate_unit: step.rateUnit || 'ml/L',
          method: step.method || 'Foliar Spray',
          notes: step.notes,
        }));

        const { error: stepsError } = await supabase
          .from('ipm_remedial_steps')
          .insert(stepsToInsert);

        if (stepsError) {
          console.error('[updateRemedialProgram] steps insert failed', stepsError);
          return { success: false, error: stepsError.message };
        }
      }
    }

    revalidatePath('/plant-health/programs');
    return getRemedialProgram(id);
  } catch (error) {
    console.error('[updateRemedialProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a remedial program (admin only)
 */
export async function deleteRemedialProgram(id: string): Promise<IpmRemedialResult> {
  try {
    // RBAC: Only admin or owner can delete programs
    const { orgId } = await requireOrgRole(['admin', 'owner']);
    const { supabase } = await getUserAndOrg();

    // Check for active applications
    const { data: activeApps } = await supabase
      .from('ipm_remedial_applications')
      .select('id')
      .eq('program_id', id)
      .eq('status', 'active')
      .limit(1);

    if (activeApps && activeApps.length > 0) {
      return {
        success: false,
        error: 'Cannot delete program with active applications. Cancel them first.',
      };
    }

    const { error } = await supabase
      .from('ipm_remedial_programs')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[deleteRemedialProgram] delete failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/programs');
    return { success: true };
  } catch (error) {
    console.error('[deleteRemedialProgram] error', error);
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
// Remedial Applications
// ============================================================================

/**
 * Apply a remedial program to a batch or location
 * Creates the application record and schedules all steps
 */
export async function applyRemedialProgram(
  input: ApplyRemedialProgramInput
): Promise<IpmRemedialResult<IpmRemedialApplication>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get the program with steps
    const { data: program, error: programError } = await supabase
      .from('ipm_remedial_programs')
      .select(`
        *,
        ipm_remedial_steps (*)
      `)
      .eq('id', input.programId)
      .eq('org_id', orgId)
      .single();

    if (programError || !program) {
      console.error('[applyRemedialProgram] program not found', programError);
      return { success: false, error: 'Program not found' };
    }

    const steps = (program.ipm_remedial_steps || []) as Array<{
      id: string;
      day_offset: number;
      step_order: number;
    }>;
    const startDate = new Date();
    const expectedCompletion = new Date(startDate);
    expectedCompletion.setDate(expectedCompletion.getDate() + program.treatment_duration_days);

    // Create the application
    const { data: application, error: appError } = await supabase
      .from('ipm_remedial_applications')
      .insert({
        org_id: orgId,
        program_id: input.programId,
        triggered_by_log_id: input.triggeredByLogId,
        target_type: input.targetType,
        target_batch_id: input.targetType === 'batch' ? input.targetBatchId : null,
        target_location_id: input.targetType === 'location' ? input.targetLocationId : null,
        started_at: startDate.toISOString().split('T')[0],
        expected_completion: expectedCompletion.toISOString().split('T')[0],
        status: 'active',
        steps_completed: 0,
        total_steps: steps.length,
        notes: input.notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (appError || !application) {
      console.error('[applyRemedialProgram] application insert failed', appError);
      return { success: false, error: appError?.message || 'Failed to create application' };
    }

    // Create application steps with due dates
    if (steps.length > 0) {
      const applicationSteps = steps.map((step) => {
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + step.day_offset);
        return {
          application_id: application.id,
          step_id: step.id,
          due_date: dueDate.toISOString().split('T')[0],
        };
      });

      const { error: stepsError } = await supabase
        .from('ipm_remedial_application_steps')
        .insert(applicationSteps);

      if (stepsError) {
        console.error('[applyRemedialProgram] application steps insert failed', stepsError);
        // Clean up the application
        await supabase.from('ipm_remedial_applications').delete().eq('id', application.id);
        return { success: false, error: stepsError.message };
      }
    }

    revalidatePath('/plant-health');
    revalidatePath('/plant-health/scout');

    // Re-fetch the complete application
    return getRemedialApplication(application.id);
  } catch (error) {
    console.error('[applyRemedialProgram] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a single remedial application by ID
 */
export async function getRemedialApplication(
  id: string
): Promise<IpmRemedialResult<IpmRemedialApplication>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_remedial_applications')
      .select(`
        *,
        ipm_remedial_programs (*),
        batches (id, batch_number),
        nursery_locations (id, name),
        ipm_remedial_application_steps (
          *,
          ipm_remedial_steps (
            *,
            ipm_products (*)
          )
        )
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[getRemedialApplication] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeApplication(data as Record<string, unknown>) };
  } catch (error) {
    console.error('[getRemedialApplication] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List active remedial applications
 */
export async function listRemedialApplications(
  filters?: RemedialApplicationFilters
): Promise<IpmRemedialResult<IpmRemedialApplication[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_remedial_applications')
      .select(`
        *,
        ipm_remedial_programs (name, target_pest_disease, treatment_urgency),
        batches (id, batch_number),
        nursery_locations (id, name),
        ipm_remedial_application_steps (
          *,
          ipm_remedial_steps (
            *,
            ipm_products (name)
          )
        )
      `)
      .eq('org_id', orgId)
      .order('started_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.programId) {
      query = query.eq('program_id', filters.programId);
    }
    if (filters?.batchId) {
      query = query.eq('target_batch_id', filters.batchId);
    }
    if (filters?.locationId) {
      query = query.eq('target_location_id', filters.locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[listRemedialApplications] query failed', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map((row) => normalizeApplication(row as Record<string, unknown>)),
    };
  } catch (error) {
    console.error('[listRemedialApplications] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get active remedial applications (for dashboard)
 */
export async function getActiveRemedialApplications(): Promise<IpmRemedialResult<IpmRemedialApplication[]>> {
  return listRemedialApplications({ status: 'active' });
}

/**
 * Complete a step in a remedial application
 */
export async function completeRemedialStep(
  applicationStepId: string,
  notes?: string
): Promise<IpmRemedialResult<IpmRemedialApplicationStep>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Verify the step belongs to an application in this org
    const { data: stepData, error: stepError } = await supabase
      .from('ipm_remedial_application_steps')
      .select(`
        *,
        ipm_remedial_applications!inner (org_id)
      `)
      .eq('id', applicationStepId)
      .single();

    if (stepError || !stepData) {
      return { success: false, error: 'Step not found' };
    }

    const appOrgId = (stepData.ipm_remedial_applications as { org_id: string }).org_id;
    if (appOrgId !== orgId) {
      return { success: false, error: 'Step not found' };
    }

    // Mark the step as completed
    const { data: updated, error: updateError } = await supabase
      .from('ipm_remedial_application_steps')
      .update({
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        notes: notes || null,
      })
      .eq('id', applicationStepId)
      .select(`
        *,
        ipm_remedial_steps (
          *,
          ipm_products (*)
        )
      `)
      .single();

    if (updateError) {
      console.error('[completeRemedialStep] update failed', updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath('/plant-health');

    return { success: true, data: normalizeApplicationStep(updated as Record<string, unknown>) };
  } catch (error) {
    console.error('[completeRemedialStep] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel a remedial application
 */
export async function cancelRemedialApplication(id: string): Promise<IpmRemedialResult> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_remedial_applications')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[cancelRemedialApplication] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health');
    return { success: true };
  } catch (error) {
    console.error('[cancelRemedialApplication] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Dashboard Queries
// ============================================================================

/**
 * Get upcoming remedial steps due in the next N days
 */
export async function getUpcomingRemedialSteps(
  days: number = 7
): Promise<IpmRemedialResult<IpmRemedialApplicationStep[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { data, error } = await supabase
      .from('ipm_remedial_application_steps')
      .select(`
        *,
        ipm_remedial_steps (
          *,
          ipm_products (*)
        ),
        ipm_remedial_applications!inner (
          org_id,
          status,
          target_type,
          target_batch_id,
          target_location_id,
          batches (id, batch_number),
          nursery_locations (id, name),
          ipm_remedial_programs (name, target_pest_disease)
        )
      `)
      .is('completed_at', null)
      .lte('due_date', endDate.toISOString().split('T')[0])
      .order('due_date');

    if (error) {
      console.error('[getUpcomingRemedialSteps] query failed', error);
      return { success: false, error: error.message };
    }

    // Filter by org (RLS should handle this, but be safe)
    const filteredData = (data || []).filter((row) => {
      const app = row.ipm_remedial_applications as { org_id: string; status: string };
      return app.org_id === orgId && app.status === 'active';
    });

    return {
      success: true,
      data: filteredData.map((row) => normalizeApplicationStep(row as Record<string, unknown>)),
    };
  } catch (error) {
    console.error('[getUpcomingRemedialSteps] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export type PestOption = {
  label: string;
  category: string | null;
};

/**
 * Get list of unique pest/disease values for dropdown (simple string array)
 */
export async function getRemedialPestOptions(): Promise<IpmRemedialResult<string[]>> {
  const result = await getRemedialPestOptionsGrouped();
  if (!result.success) return result;
  return { success: true, data: result.data!.map((opt) => opt.label) };
}

/**
 * Get list of pest/disease options with categories for grouped dropdown
 */
export async function getRemedialPestOptionsGrouped(): Promise<IpmRemedialResult<PestOption[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Get from attribute_options for plant_health_issue
    const { data, error } = await supabase
      .from('attribute_options')
      .select('display_label, category')
      .eq('org_id', orgId)
      .eq('attribute_key', 'plant_health_issue')
      .eq('is_active', true)
      .order('category')
      .order('sort_order');

    if (error) {
      console.error('[getRemedialPestOptionsGrouped] query failed', error);
      return { success: false, error: error.message };
    }

    let options: PestOption[] = (data || []).map((row) => ({
      label: row.display_label,
      category: row.category ?? null,
    }));

    // If no custom options exist, use defaults
    if (options.length === 0) {
      const { defaultOptionsFor } = await import('@/lib/attributeOptions');
      options = defaultOptionsFor('plant_health_issue').map((opt) => ({
        label: opt.displayLabel,
        category: opt.category ?? null,
      }));
    }

    return { success: true, data: options };
  } catch (error) {
    console.error('[getRemedialPestOptionsGrouped] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
