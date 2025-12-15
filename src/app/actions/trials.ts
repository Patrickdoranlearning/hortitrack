'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';
import type {
  Trial,
  TrialGroup,
  TrialSubject,
  TrialMeasurement,
  TrialTreatment,
  TrialFinding,
  TrialWithRelations,
  TrialGroupWithSubjects,
  TrialSummary,
  TrialSetupInput,
  MeasurementInput,
  GroupStrategy,
} from '@/types/trial';

// ============================================================================
// Types
// ============================================================================

export type TrialResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// Normalize Functions
// ============================================================================

function normalizeTrial(row: any): Trial {
  return {
    id: row.id,
    orgId: row.org_id,
    trialNumber: row.trial_number,
    name: row.name,
    description: row.description,
    hypothesis: row.hypothesis,
    objective: row.objective,
    methodology: row.methodology,
    varietyId: row.variety_id,
    targetSizeId: row.target_size_id,
    startDate: row.start_date,
    plannedEndDate: row.planned_end_date,
    actualEndDate: row.actual_end_date,
    measurementFrequencyDays: row.measurement_frequency_days ?? 7,
    status: row.status ?? 'draft',
    protocolId: row.protocol_id,
    trialLocationId: row.trial_location_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTrialWithRelations(row: any): TrialWithRelations {
  const trial = normalizeTrial(row);
  return {
    ...trial,
    variety: row.plant_varieties ? { id: row.plant_varieties.id, name: row.plant_varieties.name } : null,
    location: row.nursery_locations ? { id: row.nursery_locations.id, name: row.nursery_locations.name } : null,
    protocol: row.protocols ? { id: row.protocols.id, name: row.protocols.name } : null,
    groups: row.trial_groups?.map(normalizeGroupWithSubjects),
    findings: row.trial_findings?.map(normalizeFinding),
  };
}

function normalizeGroup(row: any): TrialGroup {
  return {
    id: row.id,
    trialId: row.trial_id,
    name: row.name,
    groupType: row.group_type,
    sortOrder: row.sort_order ?? 0,
    description: row.description,
    strategy: row.strategy ?? {},
    targetPlantCount: row.target_plant_count ?? 3,
    labelColor: row.label_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeGroupWithSubjects(row: any): TrialGroupWithSubjects {
  const group = normalizeGroup(row);
  return {
    ...group,
    subjects: row.trial_subjects?.map(normalizeSubject),
    treatments: row.trial_treatments?.map(normalizeTreatment),
    measurementCount: row.measurement_count,
    latestMeasurementDate: row.latest_measurement_date,
  };
}

function normalizeSubject(row: any): TrialSubject {
  return {
    id: row.id,
    groupId: row.group_id,
    subjectNumber: row.subject_number,
    label: row.label,
    batchId: row.batch_id,
    plantIdentifier: row.plant_identifier,
    locationId: row.location_id,
    positionNotes: row.position_notes,
    initialHeightCm: row.initial_height_cm,
    initialLeafCount: row.initial_leaf_count,
    initialVigorScore: row.initial_vigor_score,
    initialPhotoUrl: row.initial_photo_url,
    isActive: row.is_active ?? true,
    dropoutReason: row.dropout_reason,
    dropoutDate: row.dropout_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeMeasurement(row: any): TrialMeasurement {
  return {
    id: row.id,
    subjectId: row.subject_id,
    measurementDate: row.measurement_date,
    weekNumber: row.week_number,
    heightCm: row.height_cm,
    stemDiameterMm: row.stem_diameter_mm,
    leafCount: row.leaf_count,
    rootScore: row.root_score,
    biomassG: row.biomass_g,
    canopyWidthCm: row.canopy_width_cm,
    internodeLengthMm: row.internode_length_mm,
    ec: row.ec,
    ph: row.ph,
    temperatureC: row.temperature_c,
    humidityPct: row.humidity_pct,
    lightLevelLux: row.light_level_lux,
    colorScore: row.color_score,
    vigorScore: row.vigor_score,
    pestScore: row.pest_score,
    diseaseScore: row.disease_score,
    overallHealthScore: row.overall_health_score,
    flowersCount: row.flowers_count,
    fruitsCount: row.fruits_count,
    harvestWeightG: row.harvest_weight_g,
    qualityGrade: row.quality_grade,
    photoUrls: row.photo_urls,
    observations: row.observations,
    anomalies: row.anomalies,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTreatment(row: any): TrialTreatment {
  return {
    id: row.id,
    groupId: row.group_id,
    treatmentType: row.treatment_type,
    treatmentDate: row.treatment_date,
    ipmProductId: row.ipm_product_id,
    materialId: row.material_id,
    protocolId: row.protocol_id,
    name: row.name,
    rate: row.rate,
    rateUnit: row.rate_unit,
    method: row.method,
    quantityApplied: row.quantity_applied,
    notes: row.notes,
    appliedBy: row.applied_by,
    createdAt: row.created_at,
  };
}

function normalizeFinding(row: any): TrialFinding {
  return {
    id: row.id,
    trialId: row.trial_id,
    findingType: row.finding_type,
    title: row.title,
    description: row.description,
    supportingData: row.supporting_data,
    recommendedProtocolChanges: row.recommended_protocol_changes,
    status: row.status ?? 'draft',
    implementedAt: row.implemented_at,
    implementedProtocolId: row.implemented_protocol_id,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTrialSummary(row: any): TrialSummary {
  return {
    id: row.id,
    orgId: row.org_id,
    trialNumber: row.trial_number,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    plannedEndDate: row.planned_end_date,
    varietyName: row.variety_name,
    groupCount: parseInt(row.group_count) || 0,
    subjectCount: parseInt(row.subject_count) || 0,
    measurementCount: parseInt(row.measurement_count) || 0,
    lastMeasurementDate: row.last_measurement_date,
    currentWeek: parseInt(row.current_week) || 0,
  };
}

// ============================================================================
// Trial CRUD
// ============================================================================

export async function listTrials(filters?: {
  status?: string;
  varietyId?: string;
}): Promise<TrialResult<TrialSummary[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('v_trial_summary')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.varietyId) query = query.eq('variety_id', filters.varietyId);

    const { data, error } = await query;

    if (error) {
      console.error('[listTrials] query failed', error);
      // Fallback to direct query if view doesn't exist yet
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('trials')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (fallbackError) {
        return { success: false, error: fallbackError.message };
      }

      const summaries = (fallbackData || []).map((t: any) => ({
        id: t.id,
        orgId: t.org_id,
        trialNumber: t.trial_number,
        name: t.name,
        status: t.status,
        startDate: t.start_date,
        plannedEndDate: t.planned_end_date,
        varietyName: null,
        groupCount: 0,
        subjectCount: 0,
        measurementCount: 0,
        lastMeasurementDate: null,
        currentWeek: 0,
      }));
      return { success: true, data: summaries };
    }

    return { success: true, data: (data || []).map(normalizeTrialSummary) };
  } catch (error) {
    console.error('[listTrials] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getTrial(id: string): Promise<TrialResult<TrialWithRelations>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('trials')
      .select(`
        *,
        plant_varieties (id, name),
        nursery_locations (id, name),
        protocols (id, name),
        trial_groups (
          *,
          trial_subjects (*),
          trial_treatments (*)
        ),
        trial_findings (*)
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error) {
      console.error('[getTrial] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeTrialWithRelations(data) };
  } catch (error) {
    console.error('[getTrial] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function generateTrialNumber(): Promise<TrialResult<string>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase.rpc('generate_trial_number', {
      p_org_id: orgId,
    });

    if (error) {
      console.error('[generateTrialNumber] rpc failed', error);
      // Fallback to generating in JS
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('trials')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .like('trial_number', `TRL-${year}-%`);

      const seq = (count || 0) + 1;
      return { success: true, data: `TRL-${year}-${String(seq).padStart(3, '0')}` };
    }

    return { success: true, data: data };
  } catch (error) {
    console.error('[generateTrialNumber] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createTrial(input: TrialSetupInput): Promise<TrialResult<TrialWithRelations>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Generate trial number
    const numberResult = await generateTrialNumber();
    if (!numberResult.success || !numberResult.data) {
      return { success: false, error: 'Failed to generate trial number' };
    }

    // Create trial
    const { data: trial, error: trialError } = await supabase
      .from('trials')
      .insert({
        org_id: orgId,
        trial_number: numberResult.data,
        name: input.name,
        description: input.description,
        hypothesis: input.hypothesis,
        objective: input.objective,
        methodology: input.methodology,
        variety_id: input.varietyId || null,
        target_size_id: input.targetSizeId || null,
        start_date: input.startDate || null,
        planned_end_date: input.plannedEndDate || null,
        measurement_frequency_days: input.measurementFrequencyDays ?? 7,
        status: 'draft',
        protocol_id: input.protocolId || null,
        trial_location_id: input.trialLocationId || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (trialError) {
      console.error('[createTrial] trial insert failed', trialError);
      return { success: false, error: trialError.message };
    }

    // Create groups with subjects
    for (let i = 0; i < input.groups.length; i++) {
      const groupInput = input.groups[i];

      const { data: group, error: groupError } = await supabase
        .from('trial_groups')
        .insert({
          trial_id: trial.id,
          name: groupInput.name,
          group_type: groupInput.groupType,
          sort_order: i,
          description: groupInput.description,
          strategy: groupInput.strategy,
          target_plant_count: groupInput.targetPlantCount,
          label_color: groupInput.labelColor,
        })
        .select()
        .single();

      if (groupError) {
        console.error('[createTrial] group insert failed', groupError);
        // Rollback: delete the trial
        await supabase.from('trials').delete().eq('id', trial.id);
        return { success: false, error: groupError.message };
      }

      // Create subjects for this group
      if (groupInput.subjects && groupInput.subjects.length > 0) {
        const subjectsToInsert = groupInput.subjects.map((subject) => ({
          group_id: group.id,
          subject_number: subject.subjectNumber,
          label: subject.label || `${groupInput.name}-${subject.subjectNumber}`,
          batch_id: subject.batchId || null,
          plant_identifier: subject.plantIdentifier || null,
          location_id: subject.locationId || null,
          position_notes: subject.positionNotes || null,
          initial_height_cm: subject.initialHeightCm || null,
          initial_leaf_count: subject.initialLeafCount || null,
          initial_vigor_score: subject.initialVigorScore || null,
        }));

        const { error: subjectsError } = await supabase
          .from('trial_subjects')
          .insert(subjectsToInsert);

        if (subjectsError) {
          console.error('[createTrial] subjects insert failed', subjectsError);
          await supabase.from('trials').delete().eq('id', trial.id);
          return { success: false, error: subjectsError.message };
        }
      } else {
        // Auto-create subjects based on targetPlantCount
        const autoSubjects = Array.from({ length: groupInput.targetPlantCount }, (_, j) => ({
          group_id: group.id,
          subject_number: j + 1,
          label: `${groupInput.name}-${j + 1}`,
        }));

        const { error: autoSubjectsError } = await supabase
          .from('trial_subjects')
          .insert(autoSubjects);

        if (autoSubjectsError) {
          console.error('[createTrial] auto subjects insert failed', autoSubjectsError);
          await supabase.from('trials').delete().eq('id', trial.id);
          return { success: false, error: autoSubjectsError.message };
        }
      }
    }

    revalidatePath('/plant-health/trials');
    return getTrial(trial.id);
  } catch (error) {
    console.error('[createTrial] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateTrial(
  id: string,
  input: Partial<TrialSetupInput>
): Promise<TrialResult<TrialWithRelations>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.hypothesis !== undefined) updateData.hypothesis = input.hypothesis;
    if (input.objective !== undefined) updateData.objective = input.objective;
    if (input.methodology !== undefined) updateData.methodology = input.methodology;
    if (input.varietyId !== undefined) updateData.variety_id = input.varietyId || null;
    if (input.targetSizeId !== undefined) updateData.target_size_id = input.targetSizeId || null;
    if (input.startDate !== undefined) updateData.start_date = input.startDate || null;
    if (input.plannedEndDate !== undefined) updateData.planned_end_date = input.plannedEndDate || null;
    if (input.measurementFrequencyDays !== undefined) updateData.measurement_frequency_days = input.measurementFrequencyDays;
    if (input.protocolId !== undefined) updateData.protocol_id = input.protocolId || null;
    if (input.trialLocationId !== undefined) updateData.trial_location_id = input.trialLocationId || null;

    const { error } = await supabase
      .from('trials')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[updateTrial] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    revalidatePath(`/plant-health/trials/${id}`);
    return getTrial(id);
  } catch (error) {
    console.error('[updateTrial] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateTrialStatus(
  id: string,
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
): Promise<TrialResult<TrialWithRelations>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set start date when activating
    if (status === 'active') {
      const { data: current } = await supabase
        .from('trials')
        .select('start_date')
        .eq('id', id)
        .single();

      if (!current?.start_date) {
        updateData.start_date = new Date().toISOString().split('T')[0];
      }
    }

    // Set end date when completing
    if (status === 'completed') {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
    }

    const { error } = await supabase
      .from('trials')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[updateTrialStatus] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    revalidatePath(`/plant-health/trials/${id}`);
    return getTrial(id);
  } catch (error) {
    console.error('[updateTrialStatus] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteTrial(id: string): Promise<TrialResult> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('trials')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[deleteTrial] delete failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true };
  } catch (error) {
    console.error('[deleteTrial] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Trial Groups
// ============================================================================

export async function createTrialGroup(
  trialId: string,
  input: {
    name: string;
    groupType: 'control' | 'treatment';
    description?: string;
    strategy?: GroupStrategy;
    targetPlantCount?: number;
    labelColor?: string;
  }
): Promise<TrialResult<TrialGroup>> {
  try {
    const { supabase } = await getUserAndOrg();

    // Get next sort order
    const { data: existing } = await supabase
      .from('trial_groups')
      .select('sort_order')
      .eq('trial_id', trialId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('trial_groups')
      .insert({
        trial_id: trialId,
        name: input.name,
        group_type: input.groupType,
        sort_order: sortOrder,
        description: input.description,
        strategy: input.strategy || {},
        target_plant_count: input.targetPlantCount ?? 3,
        label_color: input.labelColor,
      })
      .select()
      .single();

    if (error) {
      console.error('[createTrialGroup] insert failed', error);
      return { success: false, error: error.message };
    }

    // Auto-create subjects
    const subjects = Array.from({ length: input.targetPlantCount ?? 3 }, (_, i) => ({
      group_id: data.id,
      subject_number: i + 1,
      label: `${input.name}-${i + 1}`,
    }));

    await supabase.from('trial_subjects').insert(subjects);

    revalidatePath(`/plant-health/trials/${trialId}`);
    return { success: true, data: normalizeGroup(data) };
  } catch (error) {
    console.error('[createTrialGroup] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateTrialGroup(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    strategy: GroupStrategy;
    labelColor: string;
  }>
): Promise<TrialResult<TrialGroup>> {
  try {
    const { supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.strategy !== undefined) updateData.strategy = input.strategy;
    if (input.labelColor !== undefined) updateData.label_color = input.labelColor;

    const { data, error } = await supabase
      .from('trial_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateTrialGroup] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeGroup(data) };
  } catch (error) {
    console.error('[updateTrialGroup] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteTrialGroup(id: string): Promise<TrialResult> {
  try {
    const { supabase } = await getUserAndOrg();

    const { error } = await supabase
      .from('trial_groups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteTrialGroup] delete failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true };
  } catch (error) {
    console.error('[deleteTrialGroup] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Trial Subjects
// ============================================================================

export async function updateTrialSubject(
  id: string,
  input: Partial<{
    label: string;
    batchId: string;
    plantIdentifier: string;
    locationId: string;
    positionNotes: string;
    initialHeightCm: number;
    initialLeafCount: number;
    initialVigorScore: number;
    initialPhotoUrl: string;
  }>
): Promise<TrialResult<TrialSubject>> {
  try {
    const { supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.label !== undefined) updateData.label = input.label;
    if (input.batchId !== undefined) updateData.batch_id = input.batchId || null;
    if (input.plantIdentifier !== undefined) updateData.plant_identifier = input.plantIdentifier;
    if (input.locationId !== undefined) updateData.location_id = input.locationId || null;
    if (input.positionNotes !== undefined) updateData.position_notes = input.positionNotes;
    if (input.initialHeightCm !== undefined) updateData.initial_height_cm = input.initialHeightCm;
    if (input.initialLeafCount !== undefined) updateData.initial_leaf_count = input.initialLeafCount;
    if (input.initialVigorScore !== undefined) updateData.initial_vigor_score = input.initialVigorScore;
    if (input.initialPhotoUrl !== undefined) updateData.initial_photo_url = input.initialPhotoUrl;

    const { data, error } = await supabase
      .from('trial_subjects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateTrialSubject] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeSubject(data) };
  } catch (error) {
    console.error('[updateTrialSubject] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function dropTrialSubject(
  id: string,
  reason: string
): Promise<TrialResult<TrialSubject>> {
  try {
    const { supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('trial_subjects')
      .update({
        is_active: false,
        dropout_reason: reason,
        dropout_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[dropTrialSubject] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeSubject(data) };
  } catch (error) {
    console.error('[dropTrialSubject] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Measurements
// ============================================================================

export async function createMeasurement(input: MeasurementInput): Promise<TrialResult<TrialMeasurement>> {
  try {
    const { user, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('trial_measurements')
      .insert({
        subject_id: input.subjectId,
        measurement_date: input.measurementDate,
        week_number: input.weekNumber,
        height_cm: input.heightCm,
        stem_diameter_mm: input.stemDiameterMm,
        leaf_count: input.leafCount,
        root_score: input.rootScore,
        biomass_g: input.biomassG,
        canopy_width_cm: input.canopyWidthCm,
        internode_length_mm: input.internodeLengthMm,
        ec: input.ec,
        ph: input.ph,
        temperature_c: input.temperatureC,
        humidity_pct: input.humidityPct,
        light_level_lux: input.lightLevelLux,
        color_score: input.colorScore,
        vigor_score: input.vigorScore,
        pest_score: input.pestScore,
        disease_score: input.diseaseScore,
        overall_health_score: input.overallHealthScore,
        flowers_count: input.flowersCount,
        fruits_count: input.fruitsCount,
        harvest_weight_g: input.harvestWeightG,
        quality_grade: input.qualityGrade,
        observations: input.observations,
        anomalies: input.anomalies,
        recorded_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[createMeasurement] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeMeasurement(data) };
  } catch (error) {
    console.error('[createMeasurement] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createBulkMeasurements(
  measurements: MeasurementInput[]
): Promise<TrialResult<TrialMeasurement[]>> {
  try {
    const { user, supabase } = await getUserAndOrg();

    const toInsert = measurements.map((input) => ({
      subject_id: input.subjectId,
      measurement_date: input.measurementDate,
      week_number: input.weekNumber,
      height_cm: input.heightCm,
      stem_diameter_mm: input.stemDiameterMm,
      leaf_count: input.leafCount,
      root_score: input.rootScore,
      biomass_g: input.biomassG,
      canopy_width_cm: input.canopyWidthCm,
      internode_length_mm: input.internodeLengthMm,
      ec: input.ec,
      ph: input.ph,
      temperature_c: input.temperatureC,
      humidity_pct: input.humidityPct,
      light_level_lux: input.lightLevelLux,
      color_score: input.colorScore,
      vigor_score: input.vigorScore,
      pest_score: input.pestScore,
      disease_score: input.diseaseScore,
      overall_health_score: input.overallHealthScore,
      flowers_count: input.flowersCount,
      fruits_count: input.fruitsCount,
      harvest_weight_g: input.harvestWeightG,
      quality_grade: input.qualityGrade,
      observations: input.observations,
      anomalies: input.anomalies,
      recorded_by: user.id,
    }));

    const { data, error } = await supabase
      .from('trial_measurements')
      .insert(toInsert)
      .select();

    if (error) {
      console.error('[createBulkMeasurements] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: (data || []).map(normalizeMeasurement) };
  } catch (error) {
    console.error('[createBulkMeasurements] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getMeasurementsForTrial(
  trialId: string
): Promise<TrialResult<TrialMeasurement[]>> {
  try {
    const { supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('trial_measurements')
      .select(`
        *,
        trial_subjects!inner (
          id,
          group_id,
          trial_groups!inner (
            trial_id
          )
        )
      `)
      .eq('trial_subjects.trial_groups.trial_id', trialId)
      .order('measurement_date', { ascending: true })
      .order('subject_id');

    if (error) {
      console.error('[getMeasurementsForTrial] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeMeasurement) };
  } catch (error) {
    console.error('[getMeasurementsForTrial] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Treatments
// ============================================================================

export async function logTreatment(input: {
  groupId: string;
  treatmentType: 'ipm' | 'material' | 'protocol' | 'custom';
  treatmentDate: string;
  name: string;
  ipmProductId?: string;
  materialId?: string;
  protocolId?: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  quantityApplied?: number;
  notes?: string;
}): Promise<TrialResult<TrialTreatment>> {
  try {
    const { user, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('trial_treatments')
      .insert({
        group_id: input.groupId,
        treatment_type: input.treatmentType,
        treatment_date: input.treatmentDate,
        name: input.name,
        ipm_product_id: input.ipmProductId || null,
        material_id: input.materialId || null,
        protocol_id: input.protocolId || null,
        rate: input.rate,
        rate_unit: input.rateUnit,
        method: input.method,
        quantity_applied: input.quantityApplied,
        notes: input.notes,
        applied_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[logTreatment] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeTreatment(data) };
  } catch (error) {
    console.error('[logTreatment] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Findings
// ============================================================================

export async function createFinding(input: {
  trialId: string;
  findingType: 'observation' | 'conclusion' | 'recommendation' | 'action_item';
  title: string;
  description: string;
  supportingData?: any;
  recommendedProtocolChanges?: any;
}): Promise<TrialResult<TrialFinding>> {
  try {
    const { user, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('trial_findings')
      .insert({
        trial_id: input.trialId,
        finding_type: input.findingType,
        title: input.title,
        description: input.description,
        supporting_data: input.supportingData,
        recommended_protocol_changes: input.recommendedProtocolChanges,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[createFinding] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeFinding(data) };
  } catch (error) {
    console.error('[createFinding] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateFindingStatus(
  id: string,
  status: 'draft' | 'reviewed' | 'approved' | 'implemented',
  implementedProtocolId?: string
): Promise<TrialResult<TrialFinding>> {
  try {
    const { user, supabase } = await getUserAndOrg();

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'reviewed') updateData.reviewed_by = user.id;
    if (status === 'approved') updateData.approved_by = user.id;
    if (status === 'implemented') {
      updateData.implemented_at = new Date().toISOString();
      if (implementedProtocolId) updateData.implemented_protocol_id = implementedProtocolId;
    }

    const { data, error } = await supabase
      .from('trial_findings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateFindingStatus] update failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/trials');
    return { success: true, data: normalizeFinding(data) };
  } catch (error) {
    console.error('[updateFindingStatus] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Statistics
// ============================================================================

export async function getTrialStatistics(trialId: string): Promise<TrialResult<{
  groupStats: Array<{
    groupId: string;
    groupName: string;
    groupType: string;
    subjectCount: number;
    activeSubjects: number;
    measurementCount: number;
    avgHeight: number | null;
    avgLeafCount: number | null;
    avgVigorScore: number | null;
    avgOverallHealth: number | null;
  }>;
  weeklyProgress: Array<{
    weekNumber: number;
    measurementDate: string;
    measurementCount: number;
  }>;
}>> {
  try {
    const { supabase } = await getUserAndOrg();

    // Get trial with groups and measurements
    const { data: trial, error } = await supabase
      .from('trials')
      .select(`
        *,
        trial_groups (
          id,
          name,
          group_type,
          trial_subjects (
            id,
            is_active,
            trial_measurements (
              week_number,
              measurement_date,
              height_cm,
              leaf_count,
              vigor_score,
              overall_health_score
            )
          )
        )
      `)
      .eq('id', trialId)
      .single();

    if (error) {
      console.error('[getTrialStatistics] query failed', error);
      return { success: false, error: error.message };
    }

    // Calculate group stats
    const groupStats = trial.trial_groups.map((group: any) => {
      const subjects = group.trial_subjects || [];
      const measurements = subjects.flatMap((s: any) => s.trial_measurements || []);

      const heights = measurements.map((m: any) => m.height_cm).filter((v: any) => v != null);
      const leafCounts = measurements.map((m: any) => m.leaf_count).filter((v: any) => v != null);
      const vigorScores = measurements.map((m: any) => m.vigor_score).filter((v: any) => v != null);
      const healthScores = measurements.map((m: any) => m.overall_health_score).filter((v: any) => v != null);

      return {
        groupId: group.id,
        groupName: group.name,
        groupType: group.group_type,
        subjectCount: subjects.length,
        activeSubjects: subjects.filter((s: any) => s.is_active).length,
        measurementCount: measurements.length,
        avgHeight: heights.length > 0 ? heights.reduce((a: number, b: number) => a + b, 0) / heights.length : null,
        avgLeafCount: leafCounts.length > 0 ? leafCounts.reduce((a: number, b: number) => a + b, 0) / leafCounts.length : null,
        avgVigorScore: vigorScores.length > 0 ? vigorScores.reduce((a: number, b: number) => a + b, 0) / vigorScores.length : null,
        avgOverallHealth: healthScores.length > 0 ? healthScores.reduce((a: number, b: number) => a + b, 0) / healthScores.length : null,
      };
    });

    // Calculate weekly progress
    const allMeasurements = trial.trial_groups.flatMap((g: any) =>
      g.trial_subjects.flatMap((s: any) => s.trial_measurements || [])
    );

    const weeklyMap = new Map<number, { count: number; date: string }>();
    for (const m of allMeasurements) {
      const existing = weeklyMap.get(m.week_number);
      if (existing) {
        existing.count++;
      } else {
        weeklyMap.set(m.week_number, { count: 1, date: m.measurement_date });
      }
    }

    const weeklyProgress = Array.from(weeklyMap.entries())
      .map(([weekNumber, data]) => ({
        weekNumber,
        measurementDate: data.date,
        measurementCount: data.count,
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber);

    return {
      success: true,
      data: { groupStats, weeklyProgress },
    };
  } catch (error) {
    console.error('[getTrialStatistics] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
