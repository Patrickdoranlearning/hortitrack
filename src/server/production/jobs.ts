import "server-only";
import { getUserAndOrg } from "@/server/auth/org";
import { createTask, deleteTask, type Task } from "@/server/tasks/service";
import {
  getTemplatesForProcess,
  initializeChecklistProgress,
  type ChecklistProgress,
} from "@/server/tasks/checklist-service";
import { logError } from "@/lib/log";

// =============================================================================
// TYPES
// =============================================================================

export type JobStatus = "draft" | "unassigned" | "assigned" | "in_progress" | "completed" | "cancelled";
export type ProcessType = "potting" | "propagation" | "transplant" | "spacing" | "other";

export type ProductionJob = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  machine: string | null;
  location: string | null;
  processType: ProcessType | null;
  scheduledWeek: number | null;
  scheduledYear: number | null;
  scheduledDate: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  taskId: string | null;
  status: JobStatus;
  wizardTemplate: string | null;
  wizardProgress: Record<string, unknown>;
  checklistProgress: ChecklistProgress;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  // Computed fields from summary view
  batchCount: number;
  totalPlants: number;
  durationMinutes: number | null;
};

export type JobBatch = {
  jobId: string;
  batchId: string;
  sortOrder: number;
  addedAt: string;
  // Batch details
  batchNumber: string | null;
  varietyName: string | null;
  sizeName: string | null;
  quantity: number;
  status: string | null;
  readyAt: string | null;
};

export type CreateJobInput = {
  name: string;
  description?: string;
  machine?: string;
  location?: string;
  processType?: ProcessType;
  scheduledWeek?: number;
  scheduledYear?: number;
  scheduledDate?: string;
  wizardTemplate?: string;
  batchIds: string[];
};

export type UpdateJobInput = {
  name?: string;
  description?: string;
  machine?: string;
  location?: string;
  processType?: ProcessType;
  scheduledWeek?: number;
  scheduledYear?: number;
  scheduledDate?: string;
  wizardTemplate?: string;
  status?: JobStatus;
};

export type JobFilter = {
  status?: JobStatus | JobStatus[];
  assignedTo?: string;
  scheduledWeek?: number;
  scheduledYear?: number;
  processType?: ProcessType;
};

// =============================================================================
// ROW MAPPING
// =============================================================================

type JobRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  machine: string | null;
  location: string | null;
  process_type: string | null;
  scheduled_week: number | null;
  scheduled_year: number | null;
  scheduled_date: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  task_id: string | null;
  status: string;
  wizard_template: string | null;
  wizard_progress: Record<string, unknown> | null;
  checklist_progress: ChecklistProgress | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  batch_count?: number;
  total_plants?: number;
  duration_minutes?: number | null;
};

const DEFAULT_CHECKLIST_PROGRESS: ChecklistProgress = {
  prerequisites: [],
  postrequisites: [],
};

function mapRowToJob(row: JobRow): ProductionJob {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    machine: row.machine,
    location: row.location,
    processType: row.process_type as ProcessType | null,
    scheduledWeek: row.scheduled_week,
    scheduledYear: row.scheduled_year,
    scheduledDate: row.scheduled_date,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    assignedToEmail: row.assigned_to_email ?? null,
    taskId: row.task_id,
    status: row.status as JobStatus,
    wizardTemplate: row.wizard_template,
    wizardProgress: row.wizard_progress ?? {},
    checklistProgress: row.checklist_progress ?? DEFAULT_CHECKLIST_PROGRESS,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    batchCount: row.batch_count ?? 0,
    totalPlants: row.total_plants ?? 0,
    durationMinutes: row.duration_minutes ?? null,
  };
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all production jobs for the organization
 */
export async function getProductionJobs(filter: JobFilter = {}): Promise<ProductionJob[]> {
  const { supabase, orgId } = await getUserAndOrg();

  let query = supabase
    .from("production_jobs_summary")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query = query.in("status", filter.status);
    } else {
      query = query.eq("status", filter.status);
    }
  }

  if (filter.assignedTo) {
    query = query.eq("assigned_to", filter.assignedTo);
  }

  if (filter.scheduledWeek) {
    query = query.eq("scheduled_week", filter.scheduledWeek);
  }

  if (filter.scheduledYear) {
    query = query.eq("scheduled_year", filter.scheduledYear);
  }

  if (filter.processType) {
    query = query.eq("process_type", filter.processType);
  }

  const { data, error } = await query;

  if (error) {
    logError("[jobs/service] Error fetching jobs", { error: error.message });
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToJob);
}

/**
 * Get a single job by ID with its batches
 */
export async function getJobById(jobId: string): Promise<ProductionJob | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("production_jobs_summary")
    .select("*")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logError("[jobs/service] Error fetching job", { error: error.message, jobId });
    throw new Error(error.message);
  }

  return mapRowToJob(data);
}

/**
 * Get batches in a job
 */
export async function getJobBatches(jobId: string): Promise<JobBatch[]> {
  const { supabase, orgId } = await getUserAndOrg();

  // First verify the job belongs to the org
  const { data: job, error: jobError } = await supabase
    .from("production_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();

  if (jobError || !job) {
    throw new Error("Job not found");
  }

  const { data, error } = await supabase
    .from("production_job_batches")
    .select(`
      job_id,
      batch_id,
      sort_order,
      added_at,
      batches (
        batch_number,
        quantity,
        status,
        ready_at,
        plant_varieties (name),
        plant_sizes (name)
      )
    `)
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true });

  if (error) {
    logError("[jobs/service] Error fetching job batches", { error: error.message, jobId });
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const batches = row.batches as unknown as {
      batch_number?: string | null;
      quantity?: number | null;
      status?: string | null;
      ready_at?: string | null;
      plant_varieties?: { name?: string } | null;
      plant_sizes?: { name?: string } | null;
    } | null;

    return {
      jobId: row.job_id,
      batchId: row.batch_id,
      sortOrder: row.sort_order,
      addedAt: row.added_at,
      batchNumber: batches?.batch_number ?? null,
      varietyName: batches?.plant_varieties?.name ?? null,
      sizeName: batches?.plant_sizes?.name ?? null,
      quantity: batches?.quantity ?? 0,
      status: batches?.status ?? null,
      readyAt: batches?.ready_at ?? null,
    };
  });
}

/**
 * Get available ghost batches (not in any job)
 */
export async function getAvailableGhostBatches(): Promise<JobBatch[]> {
  const { supabase, orgId } = await getUserAndOrg();

  // Get ghost batches not already in a job
  const { data, error } = await supabase
    .from("batches")
    .select(`
      id,
      batch_number,
      quantity,
      status,
      ready_at,
      plant_varieties (name),
      plant_sizes (name)
    `)
    .eq("org_id", orgId)
    .in("status", ["Planned", "Incoming"])
    .gt("quantity", 0)
    .order("ready_at", { ascending: true });

  if (error) {
    logError("[jobs/service] Error fetching ghost batches", { error: error.message });
    throw new Error(error.message);
  }

  // Filter out batches already in jobs
  const { data: existingBatchIds } = await supabase
    .from("production_job_batches")
    .select("batch_id");

  const usedBatchIds = new Set((existingBatchIds ?? []).map((r) => r.batch_id));

  return (data ?? [])
    .filter((b) => !usedBatchIds.has(b.id))
    .map((b) => ({
      jobId: "",
      batchId: b.id,
      sortOrder: 0,
      addedAt: "",
      batchNumber: b.batch_number,
      varietyName: (b.plant_varieties as { name?: string })?.name ?? null,
      sizeName: (b.plant_sizes as { name?: string })?.name ?? null,
      quantity: b.quantity ?? 0,
      status: b.status,
      readyAt: b.ready_at,
    }));
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new production job with batches
 */
export async function createJob(input: CreateJobInput): Promise<ProductionJob> {
  const { supabase, orgId, user } = await getUserAndOrg();

  // Create the job
  const { data: job, error: jobError } = await supabase
    .from("production_jobs")
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description ?? null,
      machine: input.machine ?? null,
      location: input.location ?? null,
      process_type: input.processType ?? null,
      scheduled_week: input.scheduledWeek ?? null,
      scheduled_year: input.scheduledYear ?? null,
      scheduled_date: input.scheduledDate ?? null,
      wizard_template: input.wizardTemplate ?? input.processType ?? null,
      status: "unassigned",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (jobError || !job) {
    logError("[jobs/service] Error creating job", { error: jobError?.message });
    throw new Error(jobError?.message ?? "Failed to create job");
  }

  // Add batches to the job
  if (input.batchIds.length > 0) {
    const batchInserts = input.batchIds.map((batchId, index) => ({
      job_id: job.id,
      batch_id: batchId,
      sort_order: index,
    }));

    const { error: batchError } = await supabase
      .from("production_job_batches")
      .insert(batchInserts);

    if (batchError) {
      logError("[jobs/service] Error adding batches to job", { error: batchError.message, jobId: job.id });
      // Don't throw - job was created, batches can be added later
    }
  }

  // Calculate total plants for the job
  const { data: batchData } = await supabase
    .from("batches")
    .select("quantity")
    .in("id", input.batchIds);

  const totalPlants = (batchData ?? []).reduce((sum, b) => sum + (b.quantity ?? 0), 0);

  return {
    ...mapRowToJob(job),
    batchCount: input.batchIds.length,
    totalPlants,
  };
}

/**
 * Update a job
 */
export async function updateJob(
  jobId: string,
  input: UpdateJobInput
): Promise<ProductionJob> {
  const { supabase, orgId } = await getUserAndOrg();

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.machine !== undefined) updateData.machine = input.machine;
  if (input.location !== undefined) updateData.location = input.location;
  if (input.processType !== undefined) updateData.process_type = input.processType;
  if (input.scheduledWeek !== undefined) updateData.scheduled_week = input.scheduledWeek;
  if (input.scheduledYear !== undefined) updateData.scheduled_year = input.scheduledYear;
  if (input.scheduledDate !== undefined) updateData.scheduled_date = input.scheduledDate;
  if (input.wizardTemplate !== undefined) updateData.wizard_template = input.wizardTemplate;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from("production_jobs")
    .update(updateData)
    .eq("id", jobId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[jobs/service] Error updating job", { error: error.message, jobId });
    throw new Error(error.message);
  }

  // Fetch full job with summary data
  const fullJob = await getJobById(jobId);
  return fullJob ?? mapRowToJob(data);
}

/**
 * Assign a job to an employee (creates a task)
 */
export async function assignJob(
  jobId: string,
  assignedTo: string,
  scheduledDate?: string
): Promise<{ job: ProductionJob; task: Task }> {
  const { supabase, orgId } = await getUserAndOrg();

  // Get the job first
  const job = await getJobById(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Create a task for this job
  const task = await createTask({
    sourceModule: "production",
    sourceRefType: "job",
    sourceRefId: jobId,
    title: job.name,
    description: job.description ?? undefined,
    taskType: job.processType ?? "production",
    assignedTo,
    scheduledDate: scheduledDate ?? job.scheduledDate ?? undefined,
    plantQuantity: job.totalPlants,
  });

  // Update the job with assignment
  const { data, error } = await supabase
    .from("production_jobs")
    .update({
      assigned_to: assignedTo,
      task_id: task.id,
      status: "assigned",
      scheduled_date: scheduledDate ?? job.scheduledDate,
    })
    .eq("id", jobId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[jobs/service] Error assigning job", { error: error.message, jobId });
    throw new Error(error.message);
  }

  const updatedJob = await getJobById(jobId);
  return { job: updatedJob ?? mapRowToJob(data), task };
}

/**
 * Start a job (records started_at)
 */
export async function startJob(jobId: string): Promise<ProductionJob> {
  const { supabase, orgId } = await getUserAndOrg();

  // Get job to update its task as well
  const job = await getJobById(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Use same timestamp for both job and task for consistency
  const startedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("production_jobs")
    .update({
      status: "in_progress",
      started_at: startedAt,
    })
    .eq("id", jobId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[jobs/service] Error starting job", { error: error.message, jobId });
    throw new Error(error.message);
  }

  // Sync the associated task status
  if (job.taskId) {
    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        started_at: startedAt,
      })
      .eq("id", job.taskId)
      .eq("org_id", orgId);

    if (taskError) {
      logError("[jobs/service] Failed to sync task status", {
        jobId,
        taskId: job.taskId,
        error: taskError.message,
      });
    }
  }

  const updatedJob = await getJobById(jobId);
  return updatedJob ?? mapRowToJob(data);
}

/**
 * Complete a job (actualizes batches and logs productivity atomically)
 */
export async function completeJob(
  jobId: string,
  wizardData?: Record<string, unknown>
): Promise<ProductionJob> {
  const { supabase, orgId, user } = await getUserAndOrg();

  const { data, error } = await supabase.rpc(
    'complete_production_job',
    {
      p_org_id: orgId,
      p_job_id: jobId,
      p_user_id: user.id,
      p_wizard_data: wizardData || null
    }
  );

  if (error) {
    logError("[jobs/service] Error completing job (RPC)", { error: error.message, jobId });
    throw new Error(error.message);
  }

  const updatedJob = await getJobById(jobId);
  if (!updatedJob) throw new Error("Failed to fetch updated job");
  return updatedJob;
}

/**
 * Add batches to an existing job
 */
export async function addBatchesToJob(
  jobId: string,
  batchIds: string[]
): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  // Verify job exists and belongs to org
  const { data: job, error: jobError } = await supabase
    .from("production_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();

  if (jobError || !job) {
    throw new Error("Job not found");
  }

  // Get current max sort order
  const { data: existing } = await supabase
    .from("production_job_batches")
    .select("sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.sort_order ?? -1;

  // Add new batches
  const batchInserts = batchIds.map((batchId, index) => ({
    job_id: jobId,
    batch_id: batchId,
    sort_order: maxOrder + 1 + index,
  }));

  const { error } = await supabase
    .from("production_job_batches")
    .insert(batchInserts);

  if (error) {
    logError("[jobs/service] Error adding batches", { error: error.message, jobId });
    throw new Error(error.message);
  }
}

/**
 * Remove a batch from a job
 */
export async function removeBatchFromJob(
  jobId: string,
  batchId: string
): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  // Verify job exists and belongs to org
  const { data: job, error: jobError } = await supabase
    .from("production_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();

  if (jobError || !job) {
    throw new Error("Job not found");
  }

  const { error } = await supabase
    .from("production_job_batches")
    .delete()
    .eq("job_id", jobId)
    .eq("batch_id", batchId);

  if (error) {
    logError("[jobs/service] Error removing batch", { error: error.message, jobId, batchId });
    throw new Error(error.message);
  }
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  // Get job to delete associated task
  const job = await getJobById(jobId);

  // Delete the job (cascade will delete batch links)
  const { error } = await supabase
    .from("production_jobs")
    .delete()
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) {
    logError("[jobs/service] Error deleting job", { error: error.message, jobId });
    throw new Error(error.message);
  }

  // Delete associated task using the tasks service
  if (job?.taskId) {
    try {
      await deleteTask(job.taskId);
    } catch (taskError) {
      logError("[jobs/service] Failed to delete associated task", {
        jobId,
        taskId: job.taskId,
        error: taskError instanceof Error ? taskError.message : "Unknown error",
      });
    }
  }
}

/**
 * Initialize checklist progress for a job from templates
 */
export async function initializeJobChecklists(jobId: string): Promise<ProductionJob> {
  const { supabase, orgId } = await getUserAndOrg();

  const job = await getJobById(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Get templates for this process type
  const processType = job.processType ?? "other";
  const { prerequisites, postrequisites } = await getTemplatesForProcess("production", processType);

  // Initialize progress from templates
  const checklistProgress = initializeChecklistProgress(prerequisites, postrequisites);

  // Update the job
  const { error } = await supabase
    .from("production_jobs")
    .update({ checklist_progress: checklistProgress })
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) {
    logError("[jobs/service] Error initializing checklists", { error: error.message, jobId });
    throw new Error(error.message);
  }

  return { ...job, checklistProgress };
}

/**
 * Update checklist progress for a job
 */
export async function updateJobChecklistProgress(
  jobId: string,
  checklistProgress: ChecklistProgress
): Promise<ProductionJob> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("production_jobs")
    .update({ checklist_progress: checklistProgress })
    .eq("id", jobId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[jobs/service] Error updating checklist progress", { error: error.message, jobId });
    throw new Error(error.message);
  }

  const updatedJob = await getJobById(jobId);
  return updatedJob ?? mapRowToJob(data);
}
