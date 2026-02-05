'use server';

import { revalidatePath } from 'next/cache';
import { getUserAndOrg } from '@/server/auth/org';
import { createTask, updateTask, getTaskBySourceRef } from '@/server/tasks/service';
import { logError, logWarning } from '@/lib/log';

export type IpmTask = {
  id: string;
  orgId: string;
  batchId?: string;
  locationId?: string;
  programId?: string;
  programStepId?: string;
  spotTreatmentId?: string;
  productId: string;
  productName: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  isTankMix: boolean;
  tankMixGroupId?: string;
  scheduledDate: string;
  weekNumber: number;
  calendarWeek: number;
  status: 'pending' | 'completed' | 'skipped' | 'overdue';
  completedAt?: string;
  completedBy?: string;
  skipReason?: string;
  bottleId?: string;
  quantityUsedMl?: number;
  notes?: string;
  createdAt: string;
  // Joined data
  batch?: {
    id: string;
    batchNumber: string;
    variety?: string;
  };
  location?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    name: string;
    pcsNumber?: string;
    whiDays?: number;
  };
};

export type TaskGroup = {
  productId: string;
  productName: string;
  method?: string;
  rate?: number;
  rateUnit?: string;
  calendarWeek: number;
  weekStartDate: string;
  isTankMix: boolean;
  tankMixGroupId?: string;
  tankMixProducts?: string[];
  groupKey: string;
  tasks: IpmTask[];
  locations: { id: string; name: string; batchCount: number }[];
  totalBatches: number;
};

type TaskResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string; // For non-fatal issues that should be surfaced to the user
};

function normalizeTask(row: any): IpmTask {
  return {
    id: row.id,
    orgId: row.org_id,
    batchId: row.batch_id,
    locationId: row.location_id,
    programId: row.program_id,
    programStepId: row.program_step_id,
    spotTreatmentId: row.spot_treatment_id,
    productId: row.product_id,
    productName: row.product_name,
    rate: row.rate,
    rateUnit: row.rate_unit,
    method: row.method,
    isTankMix: row.is_tank_mix,
    tankMixGroupId: row.tank_mix_group_id,
    scheduledDate: row.scheduled_date,
    weekNumber: row.week_number,
    calendarWeek: row.calendar_week,
    status: row.status,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    skipReason: row.skip_reason,
    bottleId: row.bottle_id,
    quantityUsedMl: row.quantity_used_ml,
    notes: row.notes,
    createdAt: row.created_at,
    batch: row.batches ? {
      id: row.batches.id,
      batchNumber: row.batches.batch_number,
      variety: row.batches.plant_varieties?.name,
    } : undefined,
    location: row.nursery_locations ? {
      id: row.nursery_locations.id,
      name: row.nursery_locations.name,
    } : undefined,
    product: row.ipm_products ? {
      id: row.ipm_products.id,
      name: row.ipm_products.name,
      pcsNumber: row.ipm_products.pcs_number,
      whiDays: row.ipm_products.harvest_interval_days,
    } : undefined,
  };
}

/**
 * Generate IPM tasks for a batch based on its family's assigned programs
 * Called when a batch is potted/created
 */
export async function generateTasksForBatch(
  batchId: string,
  pottingDate: string
): Promise<TaskResult<{ tasksCreated: number }>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Get batch info including family
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(`
        id,
        batch_number,
        location_id,
        plant_variety:plant_varieties (
          id,
          name,
          family
        )
      `)
      .eq('id', batchId)
      .eq('org_id', orgId)
      .single();

    if (batchError || !batch) {
      return { success: false, error: 'Batch not found' };
    }

    const family = batch.plant_variety?.family;
    if (!family) {
      return { success: true, data: { tasksCreated: 0 } }; // No family, no programs
    }

    // Find active IPM programs assigned to this family
    const { data: assignments, error: assignError } = await supabase
      .from('ipm_assignments')
      .select(`
        id,
        program_id,
        ipm_programs (
          id,
          name,
          schedule_type,
          ipm_program_steps (
            id,
            product_id,
            week_number,
            rate,
            rate_unit,
            method,
            ipm_products (
              id,
              name
            )
          )
        )
      `)
      .eq('org_id', orgId)
      .eq('target_type', 'family')
      .eq('target_family', family)
      .eq('is_active', true);

    if (assignError) {
      console.error('[generateTasksForBatch] assignment query failed', assignError);
      return { success: false, error: assignError.message };
    }

    if (!assignments || assignments.length === 0) {
      return { success: true, data: { tasksCreated: 0 } }; // No programs assigned
    }

    const pottingDateObj = new Date(pottingDate);
    const tasksToInsert: any[] = [];

    // Group steps by week for tank mix detection
    for (const assignment of assignments) {
      const program = assignment.ipm_programs;
      if (!program?.ipm_program_steps) continue;

      // Group steps by week number to detect tank mixes
      const stepsByWeek = new Map<number, any[]>();
      for (const step of program.ipm_program_steps) {
        const week = step.week_number ?? 0;
        if (!stepsByWeek.has(week)) {
          stepsByWeek.set(week, []);
        }
        stepsByWeek.get(week)!.push(step);
      }

      // Create tasks for each week
      for (const [weekNumber, steps] of stepsByWeek.entries()) {
        const scheduledDate = new Date(pottingDateObj);
        scheduledDate.setDate(scheduledDate.getDate() + weekNumber * 7);
        
        // Calculate calendar week (ISO week number)
        const calendarWeek = getISOWeek(scheduledDate);
        
        const isTankMix = steps.length > 1;
        const tankMixGroupId = isTankMix ? crypto.randomUUID() : null;

        for (const step of steps) {
          tasksToInsert.push({
            org_id: orgId,
            batch_id: batchId,
            location_id: batch.location_id,
            program_id: program.id,
            program_step_id: step.id,
            product_id: step.product_id,
            product_name: step.ipm_products?.name || 'Unknown',
            rate: step.rate,
            rate_unit: step.rate_unit,
            method: step.method,
            is_tank_mix: isTankMix,
            tank_mix_group_id: tankMixGroupId,
            scheduled_date: scheduledDate.toISOString().split('T')[0],
            week_number: weekNumber,
            calendar_week: calendarWeek,
            status: 'pending',
          });
        }
      }
    }

    if (tasksToInsert.length === 0) {
      return { success: true, data: { tasksCreated: 0 } };
    }

    const { error: insertError } = await supabase
      .from('ipm_tasks')
      .insert(tasksToInsert);

    if (insertError) {
      console.error('[generateTasksForBatch] insert failed', insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath('/plant-health');
    return { success: true, data: { tasksCreated: tasksToInsert.length } };
  } catch (error) {
    console.error('[generateTasksForBatch] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate tasks for a spot treatment
 */
export async function generateTasksForSpotTreatment(
  spotTreatmentId: string
): Promise<TaskResult<{ tasksCreated: number }>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Get spot treatment details
    const { data: treatment, error: treatError } = await supabase
      .from('ipm_spot_treatments')
      .select(`
        *,
        ipm_products (id, name)
      `)
      .eq('id', spotTreatmentId)
      .eq('org_id', orgId)
      .single();

    if (treatError || !treatment) {
      return { success: false, error: 'Spot treatment not found' };
    }

    const tasksToInsert: any[] = [];
    const startDate = new Date(treatment.first_application_date);

    // Create task for each application
    for (let i = 0; i < treatment.applications_total; i++) {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + i * (treatment.application_interval_days || 7));
      
      const calendarWeek = getISOWeek(scheduledDate);

      tasksToInsert.push({
        org_id: orgId,
        batch_id: treatment.target_batch_id,
        location_id: treatment.target_location_id,
        spot_treatment_id: spotTreatmentId,
        product_id: treatment.product_id,
        product_name: treatment.ipm_products?.name || 'Unknown',
        rate: treatment.rate,
        rate_unit: treatment.rate_unit,
        method: treatment.method,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        week_number: i, // Application number
        calendar_week: calendarWeek,
        status: 'pending',
        notes: treatment.reason,
      });
    }

    if (tasksToInsert.length === 0) {
      return { success: true, data: { tasksCreated: 0 } };
    }

    const { error: insertError } = await supabase
      .from('ipm_tasks')
      .insert(tasksToInsert);

    if (insertError) {
      console.error('[generateTasksForSpotTreatment] insert failed', insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath('/plant-health');
    return { success: true, data: { tasksCreated: tasksToInsert.length } };
  } catch (error) {
    console.error('[generateTasksForSpotTreatment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get upcoming tasks grouped by product and calendar week
 * This helps applicators see all plants that need the same treatment
 */
export async function getGroupedTasks(options?: {
  status?: 'pending' | 'completed' | 'skipped' | 'overdue';
  fromDate?: string;
  toDate?: string;
  productId?: string;
}): Promise<TaskResult<TaskGroup[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_tasks')
      .select(`
        *,
        batches (
          id,
          batch_number,
          plant_varieties (name)
        ),
        nursery_locations (id, name),
        ipm_products (id, name, pcs_number, harvest_interval_days)
      `)
      .eq('org_id', orgId)
      .order('scheduled_date', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.fromDate) {
      query = query.gte('scheduled_date', options.fromDate);
    }
    if (options?.toDate) {
      query = query.lte('scheduled_date', options.toDate);
    }
    if (options?.productId) {
      query = query.eq('product_id', options.productId);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('[getGroupedTasks] query failed', error);
      return { success: false, error: error.message };
    }

    // Group tasks by product + calendar week + method
    const groupMap = new Map<string, TaskGroup>();

    for (const row of tasks || []) {
      const task = normalizeTask(row);
      
      // Create group key: productId-calendarWeek-method-tankMixGroupId
      const groupKey = task.tankMixGroupId 
        ? `mix-${task.tankMixGroupId}-${task.calendarWeek}`
        : `${task.productId}-${task.calendarWeek}-${task.method || 'default'}`;

      if (!groupMap.has(groupKey)) {
        const weekStartDate = getWeekStartDate(task.scheduledDate);
        // Compute the canonical group key for job matching
        const canonicalGroupKey = task.tankMixGroupId
          ? `tankmix:${task.tankMixGroupId}`
          : `product:${task.productId}-rate:${task.rate || 'default'}-method:${task.method || 'spray'}`;

        groupMap.set(groupKey, {
          productId: task.productId,
          productName: task.productName,
          method: task.method,
          rate: task.rate,
          rateUnit: task.rateUnit,
          calendarWeek: task.calendarWeek,
          weekStartDate,
          isTankMix: task.isTankMix,
          tankMixGroupId: task.tankMixGroupId,
          tankMixProducts: task.isTankMix ? [task.productName] : undefined,
          groupKey: canonicalGroupKey,
          tasks: [],
          locations: [],
          totalBatches: 0,
        });
      }

      const group = groupMap.get(groupKey)!;
      group.tasks.push(task);
      group.totalBatches++;

      // Track tank mix products
      if (task.isTankMix && group.tankMixProducts && !group.tankMixProducts.includes(task.productName)) {
        group.tankMixProducts.push(task.productName);
      }

      // Aggregate locations
      if (task.location) {
        const existingLoc = group.locations.find(l => l.id === task.location!.id);
        if (existingLoc) {
          existingLoc.batchCount++;
        } else {
          group.locations.push({
            id: task.location.id,
            name: task.location.name,
            batchCount: 1,
          });
        }
      }
    }

    // Convert to array and sort by week
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.calendarWeek !== b.calendarWeek) {
        return a.calendarWeek - b.calendarWeek;
      }
      return a.productName.localeCompare(b.productName);
    });

    return { success: true, data: groups };
  } catch (error) {
    console.error('[getGroupedTasks] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all tasks (not grouped) for a specific date range
 */
export async function getTasks(options?: {
  status?: string;
  fromDate?: string;
  toDate?: string;
  batchId?: string;
  locationId?: string;
}): Promise<TaskResult<IpmTask[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_tasks')
      .select(`
        *,
        batches (
          id,
          batch_number,
          plant_varieties (name)
        ),
        nursery_locations (id, name),
        ipm_products (id, name, pcs_number, harvest_interval_days)
      `)
      .eq('org_id', orgId)
      .order('scheduled_date', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.fromDate) {
      query = query.gte('scheduled_date', options.fromDate);
    }
    if (options?.toDate) {
      query = query.lte('scheduled_date', options.toDate);
    }
    if (options?.batchId) {
      query = query.eq('batch_id', options.batchId);
    }
    if (options?.locationId) {
      query = query.eq('location_id', options.locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getTasks] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeTask) };
  } catch (error) {
    console.error('[getTasks] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export type ComplianceData = {
  bottleId?: string;
  quantityUsedMl?: number;
  notes?: string;
  // Compliance fields for chemical applications
  pcsNumber?: string;
  cropName?: string;
  reasonForUse?: string;
  weatherConditions?: string;
  harvestIntervalDays?: number;
  safeHarvestDate?: string;
  areaTreated?: string;
  sprayerUsed?: string;
  signedBy?: string;
  fertiliserComposition?: string;
};

/**
 * Complete a task or group of tasks
 * Creates plant_health_logs for each affected batch for audit trail
 */
const BULK_RATE_LIMIT = 100; // Max tasks per request
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function completeTasks(
  taskIds: string[],
  completionData?: ComplianceData
): Promise<TaskResult> {
  // Rate limiting: Prevent bulk operations from overwhelming the database
  if (taskIds.length > BULK_RATE_LIMIT) {
    return {
      success: false,
      error: `Maximum ${BULK_RATE_LIMIT} tasks can be completed at once. Please select fewer tasks.`,
    };
  }

  // Validate all IDs are proper UUIDs to prevent injection
  if (!taskIds.every((id) => UUID_REGEX.test(id))) {
    return { success: false, error: 'Invalid task ID format' };
  }

  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // First, get the tasks to find batch info
    const { data: tasks, error: fetchError } = await supabase
      .from('ipm_tasks')
      .select(`
        id,
        batch_id,
        location_id,
        product_id,
        product_name,
        rate,
        rate_unit,
        method,
        calendar_week
      `)
      .in('id', taskIds)
      .eq('org_id', orgId);

    if (fetchError) {
      console.error('[completeTasks] fetch failed', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Update tasks with completion and compliance data
    const { error } = await supabase
      .from('ipm_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        bottle_id: completionData?.bottleId,
        quantity_used_ml: completionData?.quantityUsedMl,
        notes: completionData?.notes,
        pcs_number: completionData?.pcsNumber,
        crop_name: completionData?.cropName,
        reason_for_use: completionData?.reasonForUse,
        weather_conditions: completionData?.weatherConditions,
        harvest_interval_days: completionData?.harvestIntervalDays,
        safe_harvest_date: completionData?.safeHarvestDate,
        area_treated: completionData?.areaTreated,
        sprayer_used: completionData?.sprayerUsed,
        signed_by: completionData?.signedBy,
        fertiliser_composition: completionData?.fertiliserComposition,
        updated_at: new Date().toISOString(),
      })
      .in('id', taskIds)
      .eq('org_id', orgId);

    if (error) {
      console.error('[completeTasks] update failed', error);
      return { success: false, error: error.message };
    }

    // Create plant_health_logs for each batch (audit trail)
    if (tasks && tasks.length > 0) {
      const logsToInsert = tasks
        .filter(t => t.batch_id) // Only batches, not just locations
        .map(task => ({
          org_id: orgId,
          batch_id: task.batch_id,
          location_id: task.location_id,
          event_type: 'treatment',
          event_at: new Date().toISOString(),
          recorded_by: user.id,
          product_name: task.product_name,
          rate: task.rate,
          unit: task.rate_unit,
          method: task.method,
          notes: completionData?.notes,
          ipm_task_id: task.id,
          bottle_id: completionData?.bottleId,
          quantity_used_ml: completionData?.quantityUsedMl,
          pcs_number: completionData?.pcsNumber,
          crop_name: completionData?.cropName,
          reason_for_use: completionData?.reasonForUse,
          weather_conditions: completionData?.weatherConditions,
          harvest_interval_days: completionData?.harvestIntervalDays,
          safe_harvest_date: completionData?.safeHarvestDate,
          area_treated: completionData?.areaTreated,
          sprayer_used: completionData?.sprayerUsed,
          signed_by: completionData?.signedBy,
          fertiliser_composition: completionData?.fertiliserComposition,
        }));

      if (logsToInsert.length > 0) {
        const { error: healthLogInsertError } = await supabase
          .from('plant_health_logs')
          .insert(logsToInsert);

        if (healthLogInsertError) {
          logWarning('[completeTasks] Health log insert failed', {
            error: healthLogInsertError.message,
            taskIds,
            context: 'health_log_audit_trail',
          });
          // Don't fail the operation - tasks are completed, but warn about audit trail
          // Return with warning so UI can inform the user
          revalidatePath('/plant-health');
          revalidatePath('/batches');
          revalidatePath('/tasks');
          return {
            success: true,
            warning: 'Tasks completed but audit log failed to save. Please verify treatment records.',
          };
        }
      }
    }

    // If bottle was used, record stock movement
    if (completionData?.bottleId && completionData?.quantityUsedMl) {
      const { recordUsage } = await import('./ipm-stock');
      await recordUsage({
        bottleId: completionData.bottleId,
        quantityMl: completionData.quantityUsedMl,
        notes: `IPM Task completion`,
      });
    }

    // Sync completion to any linked generic task summaries
    if (tasks && tasks.length > 0) {
      const productWeekPairs = new Set<string>();
      for (const task of tasks) {
        if (task.product_id && task.calendar_week) {
          productWeekPairs.add(`${task.product_id}:${task.calendar_week}`);
        }
      }
      for (const pair of productWeekPairs) {
        const [productId, calendarWeek] = pair.split(':');
        try {
          await completeIpmSummaryTask({ productId, calendarWeek: parseInt(calendarWeek, 10) });
        } catch {
          // Ignore errors - summary task may not exist
        }
      }
    }

    revalidatePath('/plant-health');
    revalidatePath('/batches');
    revalidatePath('/tasks');
    return { success: true };
  } catch (error) {
    console.error('[completeTasks] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Skip a task with reason
 */
export async function skipTask(
  taskId: string,
  reason: string
): Promise<TaskResult> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_tasks')
      .update({
        status: 'skipped',
        skip_reason: reason,
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('org_id', orgId);

    if (error) {
      console.error('[skipTask] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health');
    return { success: true };
  } catch (error) {
    console.error('[skipTask] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update overdue tasks
 */
export async function markOverdueTasks(): Promise<TaskResult<{ count: number }>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ipm_tasks')
      .update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .lt('scheduled_date', today)
      .select('id');

    if (error) {
      console.error('[markOverdueTasks] update failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { count: data?.length || 0 } };
  } catch (error) {
    console.error('[markOverdueTasks] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper: Get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Helper: Get week start date (Monday)
function getWeekStartDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Bulk generate tasks for all batches with IPM programs assigned
 * Useful for initial setup or re-generating tasks
 */
export async function bulkGenerateTasks(options?: {
  clearExisting?: boolean;
  familyFilter?: string;
}): Promise<TaskResult<{ batchesProcessed: number; tasksCreated: number }>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Optionally clear existing pending tasks
    if (options?.clearExisting) {
      await supabase
        .from('ipm_tasks')
        .delete()
        .eq('org_id', orgId)
        .eq('status', 'pending');
    }

    // Get all active IPM assignments
    const { data: assignments, error: assignError } = await supabase
      .from('ipm_assignments')
      .select(`
        id,
        target_type,
        target_family,
        target_location_id,
        program_id,
        ipm_programs (
          id,
          name,
          ipm_program_steps (
            id,
            product_id,
            week_number,
            rate,
            rate_unit,
            method,
            ipm_products (id, name)
          )
        )
      `)
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (assignError) {
      console.error('[bulkGenerateTasks] assignment query failed', assignError);
      return { success: false, error: assignError.message };
    }

    if (!assignments || assignments.length === 0) {
      return { success: true, data: { batchesProcessed: 0, tasksCreated: 0 } };
    }

    // Build a map of family -> programs
    const familyPrograms = new Map<string, any[]>();
    for (const assignment of assignments) {
      if (assignment.target_type === 'family' && assignment.target_family) {
        if (!familyPrograms.has(assignment.target_family)) {
          familyPrograms.set(assignment.target_family, []);
        }
        familyPrograms.get(assignment.target_family)!.push(assignment);
      }
    }

    // Get all active batches with their family info
    let batchQuery = supabase
      .from('batches')
      .select(`
        id,
        batch_number,
        planted_at,
        location_id,
        plant_variety:plant_varieties (
          id,
          name,
          family
        )
      `)
      .eq('org_id', orgId)
      .not('status', 'in', '("Archived","Shipped")');

    if (options?.familyFilter) {
      // Filter by family - need to join
      batchQuery = batchQuery.eq('plant_variety.family', options.familyFilter);
    }

    const { data: batches, error: batchError } = await batchQuery;

    if (batchError) {
      console.error('[bulkGenerateTasks] batch query failed', batchError);
      return { success: false, error: batchError.message };
    }

    let batchesProcessed = 0;
    let tasksCreated = 0;

    // Generate tasks for each batch
    for (const batch of batches || []) {
      const family = batch.plant_variety?.family;
      if (!family || !familyPrograms.has(family)) continue;

      const pottingDate = batch.planted_at;
      if (!pottingDate) continue;

      const programs = familyPrograms.get(family)!;
      const pottingDateObj = new Date(pottingDate);
      const tasksToInsert: any[] = [];

      for (const assignment of programs) {
        const program = assignment.ipm_programs;
        if (!program?.ipm_program_steps) continue;

        // Group steps by week number
        const stepsByWeek = new Map<number, any[]>();
        for (const step of program.ipm_program_steps) {
          const week = step.week_number ?? 0;
          if (!stepsByWeek.has(week)) {
            stepsByWeek.set(week, []);
          }
          stepsByWeek.get(week)!.push(step);
        }

        // Create tasks for each week
        for (const [weekNumber, steps] of stepsByWeek.entries()) {
          const scheduledDate = new Date(pottingDateObj);
          scheduledDate.setDate(scheduledDate.getDate() + weekNumber * 7);
          
          // Skip tasks in the past (already done or missed)
          const today = new Date();
          if (scheduledDate < today) continue;

          const calendarWeek = getISOWeek(scheduledDate);
          const isTankMix = steps.length > 1;
          const tankMixGroupId = isTankMix ? crypto.randomUUID() : null;

          for (const step of steps) {
            tasksToInsert.push({
              org_id: orgId,
              batch_id: batch.id,
              location_id: batch.location_id,
              program_id: program.id,
              program_step_id: step.id,
              product_id: step.product_id,
              product_name: step.ipm_products?.name || 'Unknown',
              rate: step.rate,
              rate_unit: step.rate_unit,
              method: step.method,
              is_tank_mix: isTankMix,
              tank_mix_group_id: tankMixGroupId,
              scheduled_date: scheduledDate.toISOString().split('T')[0],
              week_number: weekNumber,
              calendar_week: calendarWeek,
              status: 'pending',
            });
          }
        }
      }

      if (tasksToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('ipm_tasks')
          .insert(tasksToInsert);

        if (!insertError) {
          tasksCreated += tasksToInsert.length;
          batchesProcessed++;
        }
      }
    }

    revalidatePath('/plant-health');
    revalidatePath('/plant-health/tasks');
    return { success: true, data: { batchesProcessed, tasksCreated } };
  } catch (error) {
    console.error('[bulkGenerateTasks] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// GENERIC TASK INTEGRATION
// =============================================================================

/**
 * Create a summary task in the generic tasks table for a group of IPM tasks.
 * This allows IPM work to appear in the unified employee schedule.
 * 
 * Called when assigning IPM work to a specific employee for a date.
 */
export async function createIpmSummaryTask(options: {
  productId: string;
  productName: string;
  calendarWeek: number;
  scheduledDate: string;
  locationId?: string;
  locationName?: string;
  batchCount: number;
  assignedTo?: string;
}): Promise<TaskResult<{ taskId: string }>> {
  try {
    // Create a composite reference ID for linking back to IPM tasks
    const sourceRefId = `ipm-${options.productId}-week${options.calendarWeek}`;
    
    // Check if task already exists
    const existingTask = await getTaskBySourceRef('plant_health', 'ipm_summary', sourceRefId);
    if (existingTask) {
      return { success: true, data: { taskId: existingTask.id } };
    }

    const task = await createTask({
      sourceModule: 'plant_health',
      sourceRefType: 'ipm_summary',
      sourceRefId,
      title: `IPM: ${options.productName} - Week ${options.calendarWeek}`,
      description: options.locationName 
        ? `Apply ${options.productName} to ${options.batchCount} batches in ${options.locationName}`
        : `Apply ${options.productName} to ${options.batchCount} batches`,
      taskType: 'ipm_treatment',
      assignedTo: options.assignedTo,
      scheduledDate: options.scheduledDate,
      plantQuantity: options.batchCount,
    });

    return { success: true, data: { taskId: task.id } };
  } catch (error) {
    console.error('[createIpmSummaryTask] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Complete an IPM summary task when the underlying IPM tasks are completed
 */
export async function completeIpmSummaryTask(options: {
  productId: string;
  calendarWeek: number;
}): Promise<TaskResult> {
  try {
    const sourceRefId = `ipm-${options.productId}-week${options.calendarWeek}`;
    const task = await getTaskBySourceRef('plant_health', 'ipm_summary', sourceRefId);
    
    if (task && task.status !== 'completed') {
      await updateTask(task.id, { status: 'completed' });
    }

    return { success: true };
  } catch (error) {
    console.error('[completeIpmSummaryTask] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign IPM work for a specific product and week to an employee
 */
export async function assignIpmWork(options: {
  productId: string;
  productName: string;
  calendarWeek: number;
  scheduledDate: string;
  assignedTo: string;
  batchCount: number;
  locationName?: string;
}): Promise<TaskResult<{ taskId: string }>> {
  try {
    const sourceRefId = `ipm-${options.productId}-week${options.calendarWeek}`;

    // Check if task already exists
    const existingTask = await getTaskBySourceRef('plant_health', 'ipm_summary', sourceRefId);

    if (existingTask) {
      // Update the existing task with new assignment
      await updateTask(existingTask.id, {
        assignedTo: options.assignedTo,
        scheduledDate: options.scheduledDate,
        status: 'assigned',
      });
      return { success: true, data: { taskId: existingTask.id } };
    }

    // Create new task
    return createIpmSummaryTask(options);
  } catch (error) {
    console.error('[assignIpmWork] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// IPM JOBS - Application Job Management
// =============================================================================

import type {
  IpmJob,
  JobStatus,
  JobPriority,
  JobLocation,
  JobBatch,
  CreateJobInput,
  AssignJobInput,
  CompleteJobInput,
  JobsByStatus,
} from '@/types/ipm-jobs';

function normalizeJob(row: any, tasks?: any[]): IpmJob {
  // Aggregate location and batch data from tasks
  const locationMap = new Map<string, JobLocation>();
  let completedTaskCount = 0;

  for (const task of tasks || []) {
    if (task.status === 'completed') completedTaskCount++;

    const locId = task.location_id || 'no-location';
    const locName = task.nursery_locations?.name || 'No Location';

    if (!locationMap.has(locId)) {
      locationMap.set(locId, {
        id: locId,
        name: locName,
        taskCount: 0,
        completedCount: 0,
        batches: [],
      });
    }

    const loc = locationMap.get(locId)!;
    loc.taskCount++;
    if (task.status === 'completed') loc.completedCount++;

    if (task.batch_id) {
      loc.batches.push({
        id: task.batch_id,
        batchNumber: task.batches?.batch_number || 'Unknown',
        variety: task.batches?.plant_varieties?.name,
        taskId: task.id,
        isCompleted: task.status === 'completed',
      });
    }
  }

  const firstTask = tasks?.[0];
  const isTankMix = firstTask?.is_tank_mix || false;
  const tankMixProducts = isTankMix
    ? [...new Set(tasks?.map((t: any) => t.product_name) || [])]
    : undefined;

  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    groupKey: row.group_key,
    scheduledDate: row.scheduled_date,
    calendarWeek: row.calendar_week,
    status: row.status as JobStatus,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_profile?.display_name || row.assigned_profile?.email,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    scoutNotes: row.scout_notes,
    priority: (row.priority || 'normal') as JobPriority,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    weatherConditions: row.weather_conditions,
    sprayerUsed: row.sprayer_used,
    totalVolumeMl: row.total_volume_ml,
    bottleId: row.bottle_id,
    quantityUsedMl: row.quantity_used_ml,
    signedBy: row.signed_by,
    notes: row.notes,
    taskCount: tasks?.length || 0,
    completedTaskCount,
    locationCount: locationMap.size,
    batchCount: tasks?.filter((t: any) => t.batch_id).length || 0,
    locations: Array.from(locationMap.values()),
    product: {
      id: firstTask?.product_id || '',
      name: firstTask?.product_name || row.name,
      pcsNumber: firstTask?.ipm_products?.pcs_number,
      rate: firstTask?.rate,
      rateUnit: firstTask?.rate_unit,
      method: firstTask?.method,
      harvestIntervalDays: firstTask?.ipm_products?.harvest_interval_days,
      isTankMix,
      tankMixProducts,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a job from a task group
 */
export async function createJob(input: CreateJobInput): Promise<TaskResult<{ job: IpmJob }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get tasks for this group to determine name
    const { data: tasks } = await supabase
      .from('ipm_tasks')
      .select('product_name, is_tank_mix')
      .eq('org_id', orgId)
      .eq('group_key', input.groupKey)
      .eq('calendar_week', input.calendarWeek)
      .limit(5);

    const isTankMix = tasks?.some(t => t.is_tank_mix);
    const productNames = [...new Set(tasks?.map(t => t.product_name) || [])];
    const defaultName = isTankMix
      ? productNames.join(' + ')
      : productNames[0] || 'IPM Application';

    const { data: job, error } = await supabase
      .from('ipm_jobs')
      .insert({
        org_id: orgId,
        name: input.name || defaultName,
        group_key: input.groupKey,
        scheduled_date: input.scheduledDate,
        calendar_week: input.calendarWeek,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint - job already exists
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('ipm_jobs')
          .select('*')
          .eq('org_id', orgId)
          .eq('group_key', input.groupKey)
          .eq('calendar_week', input.calendarWeek)
          .single();

        if (existing) {
          return { success: true, data: { job: normalizeJob(existing) } };
        }
      }
      logError('[createJob] insert failed', { error: error.message, input });
      return { success: false, error: error.message };
    }

    // Link tasks to this job
    await supabase
      .from('ipm_tasks')
      .update({ job_id: job.id })
      .eq('org_id', orgId)
      .eq('group_key', input.groupKey)
      .eq('calendar_week', input.calendarWeek);

    revalidatePath('/plant-health/tasks');
    return { success: true, data: { job: normalizeJob(job) } };
  } catch (error) {
    logError('[createJob] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign a job to an applicator
 */
export async function assignJob(input: AssignJobInput): Promise<TaskResult<{ job: IpmJob }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data: job, error } = await supabase
      .from('ipm_jobs')
      .update({
        assigned_to: input.assignedTo,
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
        scout_notes: input.scoutNotes,
        priority: input.priority || 'normal',
        status: 'assigned',
      })
      .eq('id', input.jobId)
      .eq('org_id', orgId)
      .select(`
        *,
        assigned_profile:profiles!ipm_jobs_assigned_to_fkey(display_name, email)
      `)
      .single();

    if (error) {
      logError('[assignJob] update failed', { error: error.message, input });
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/tasks');
    return { success: true, data: { job: normalizeJob(job) } };
  } catch (error) {
    logError('[assignJob] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Start a job (mark as in_progress)
 */
export async function startJob(jobId: string): Promise<TaskResult<{ job: IpmJob }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data: job, error } = await supabase
      .from('ipm_jobs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      logError('[startJob] update failed', { error: error.message, jobId });
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/tasks');
    return { success: true, data: { job: normalizeJob(job) } };
  } catch (error) {
    logError('[startJob] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Complete a job with compliance data
 */
export async function completeJob(input: CompleteJobInput): Promise<TaskResult> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get the job and its tasks
    const { data: job, error: jobError } = await supabase
      .from('ipm_jobs')
      .select('*, ipm_tasks(*)')
      .eq('id', input.jobId)
      .eq('org_id', orgId)
      .single();

    if (jobError || !job) {
      return { success: false, error: 'Job not found' };
    }

    // Update the job with completion data
    const { error: updateError } = await supabase
      .from('ipm_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        weather_conditions: input.weatherConditions,
        sprayer_used: input.sprayerUsed,
        total_volume_ml: input.totalVolumeMl,
        bottle_id: input.bottleId,
        quantity_used_ml: input.quantityUsedMl,
        signed_by: input.signedBy,
        notes: input.notes,
      })
      .eq('id', input.jobId)
      .eq('org_id', orgId);

    if (updateError) {
      logError('[completeJob] job update failed', { error: updateError.message });
      return { success: false, error: updateError.message };
    }

    // Complete all linked tasks
    const taskIds = (job.ipm_tasks || []).map((t: any) => t.id);
    if (taskIds.length > 0) {
      await completeTasks(taskIds, {
        bottleId: input.bottleId,
        quantityUsedMl: input.quantityUsedMl,
        notes: input.notes,
        weatherConditions: input.weatherConditions,
        sprayerUsed: input.sprayerUsed,
        signedBy: input.signedBy,
      });
    }

    // Record stock usage if bottle used
    if (input.bottleId && input.quantityUsedMl) {
      const { recordUsage } = await import('./ipm-stock');
      await recordUsage({
        bottleId: input.bottleId,
        quantityMl: input.quantityUsedMl,
        notes: `IPM Job completion: ${job.name}`,
      });
    }

    revalidatePath('/plant-health/tasks');
    return { success: true };
  } catch (error) {
    logError('[completeJob] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all jobs for a specific week, grouped by status (for Scout Kanban view)
 */
export async function getJobsForWeek(calendarWeek: number): Promise<TaskResult<{ jobs: JobsByStatus; taskGroups: TaskGroup[] }>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    // Get existing jobs for this week
    const { data: jobs, error: jobsError } = await supabase
      .from('ipm_jobs')
      .select(`
        *,
        assigned_profile:profiles!ipm_jobs_assigned_to_fkey(display_name, email)
      `)
      .eq('org_id', orgId)
      .eq('calendar_week', calendarWeek);

    if (jobsError) {
      logError('[getJobsForWeek] jobs query failed', { error: jobsError.message });
      return { success: false, error: jobsError.message };
    }

    // Get tasks for this week (to show ungrouped tasks and populate job details)
    const { data: tasks, error: tasksError } = await supabase
      .from('ipm_tasks')
      .select(`
        *,
        batches(id, batch_number, plant_varieties(name)),
        nursery_locations(id, name),
        ipm_products(id, name, pcs_number, harvest_interval_days)
      `)
      .eq('org_id', orgId)
      .eq('calendar_week', calendarWeek)
      .in('status', ['pending', 'overdue']);

    if (tasksError) {
      logError('[getJobsForWeek] tasks query failed', { error: tasksError.message });
      return { success: false, error: tasksError.message };
    }

    // Group tasks by job_id
    const tasksByJob = new Map<string, any[]>();
    const unassignedTasks: any[] = [];

    for (const task of tasks || []) {
      if (task.job_id) {
        if (!tasksByJob.has(task.job_id)) {
          tasksByJob.set(task.job_id, []);
        }
        tasksByJob.get(task.job_id)!.push(task);
      } else {
        unassignedTasks.push(task);
      }
    }

    // Normalize jobs with their tasks
    const normalizedJobs = (jobs || []).map(job =>
      normalizeJob(job, tasksByJob.get(job.id) || [])
    );

    // Group by status
    const jobsByStatus: JobsByStatus = {
      pending: normalizedJobs.filter(j => j.status === 'pending'),
      assigned: normalizedJobs.filter(j => j.status === 'assigned'),
      inProgress: normalizedJobs.filter(j => j.status === 'in_progress'),
      completed: normalizedJobs.filter(j => j.status === 'completed'),
    };

    // Also return task groups that don't have jobs yet (for "Create Job" UI)
    const taskGroupsResult = await getGroupedTasks({
      status: 'pending',
      fromDate: getWeekStartDate(new Date().toISOString()),
    });

    return {
      success: true,
      data: {
        jobs: jobsByStatus,
        taskGroups: taskGroupsResult.data?.filter(g => g.calendarWeek === calendarWeek) || [],
      },
    };
  } catch (error) {
    logError('[getJobsForWeek] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get jobs assigned to current user (for Applicator view)
 */
export async function getMyJobs(): Promise<TaskResult<{ jobs: IpmJob[] }>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { data: jobs, error: jobsError } = await supabase
      .from('ipm_jobs')
      .select(`
        *,
        assigned_profile:profiles!ipm_jobs_assigned_to_fkey(display_name, email)
      `)
      .eq('org_id', orgId)
      .eq('assigned_to', user.id)
      .in('status', ['assigned', 'in_progress'])
      .order('scheduled_date', { ascending: true });

    if (jobsError) {
      logError('[getMyJobs] query failed', { error: jobsError.message });
      return { success: false, error: jobsError.message };
    }

    // Get tasks for these jobs
    const jobIds = (jobs || []).map(j => j.id);
    const { data: tasks } = await supabase
      .from('ipm_tasks')
      .select(`
        *,
        batches(id, batch_number, plant_varieties(name)),
        nursery_locations(id, name),
        ipm_products(id, name, pcs_number, harvest_interval_days)
      `)
      .in('job_id', jobIds);

    // Group tasks by job
    const tasksByJob = new Map<string, any[]>();
    for (const task of tasks || []) {
      if (!tasksByJob.has(task.job_id)) {
        tasksByJob.set(task.job_id, []);
      }
      tasksByJob.get(task.job_id)!.push(task);
    }

    const normalizedJobs = (jobs || []).map(job =>
      normalizeJob(job, tasksByJob.get(job.id) || [])
    );

    return { success: true, data: { jobs: normalizedJobs } };
  } catch (error) {
    logError('[getMyJobs] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a single job with all its tasks (for execution view)
 */
export async function getJobWithTasks(jobId: string): Promise<TaskResult<{ job: IpmJob }>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data: job, error: jobError } = await supabase
      .from('ipm_jobs')
      .select(`
        *,
        assigned_profile:profiles!ipm_jobs_assigned_to_fkey(display_name, email)
      `)
      .eq('id', jobId)
      .eq('org_id', orgId)
      .single();

    if (jobError || !job) {
      return { success: false, error: 'Job not found' };
    }

    // Get all tasks for this job
    const { data: tasks } = await supabase
      .from('ipm_tasks')
      .select(`
        *,
        batches(id, batch_number, plant_varieties(name)),
        nursery_locations(id, name),
        ipm_products(id, name, pcs_number, harvest_interval_days)
      `)
      .eq('job_id', jobId)
      .order('nursery_locations(name)', { ascending: true });

    return { success: true, data: { job: normalizeJob(job, tasks || []) } };
  } catch (error) {
    logError('[getJobWithTasks] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Complete a specific task within a job (for per-location checkoff)
 */
export async function completeTaskInJob(taskId: string): Promise<TaskResult> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq('id', taskId)
      .eq('org_id', orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/tasks');
    return { success: true };
  } catch (error) {
    logError('[completeTaskInJob] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<TaskResult> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('ipm_jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId)
      .eq('org_id', orgId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Unlink tasks from this job
    await supabase
      .from('ipm_tasks')
      .update({ job_id: null })
      .eq('job_id', jobId);

    revalidatePath('/plant-health/tasks');
    return { success: true };
  } catch (error) {
    logError('[cancelJob] error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
