import "server-only";
import { getUserAndOrg } from "@/server/auth/org";

// =============================================================================
// TYPES
// =============================================================================

export type TaskStatus = "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
export type SourceModule = "production" | "dispatch" | "plant_health";

export type Task = {
  id: string;
  orgId: string;
  sourceModule: SourceModule;
  sourceRefType: string | null;
  sourceRefId: string | null;
  title: string;
  description: string | null;
  taskType: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  assignedTeamId: string | null;
  assignedTeamName: string | null;
  scheduledDate: string | null;
  priority: number;
  status: TaskStatus;
  plantQuantity: number | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  plantsPerHour: number | null;
  createdAt: string;
  createdBy: string | null;
  completedBy: string | null;
  updatedAt: string;
};

export type CreateTaskInput = {
  sourceModule: SourceModule;
  sourceRefType?: string;
  sourceRefId?: string;
  title: string;
  description?: string;
  taskType?: string;
  assignedTo?: string;
  assignedTeamId?: string;
  scheduledDate?: string;
  priority?: number;
  plantQuantity?: number;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  assignedTo?: string | null;
  assignedTeamId?: string | null;
  scheduledDate?: string | null;
  priority?: number;
  status?: TaskStatus;
  plantQuantity?: number;
};

export type TaskFilter = {
  status?: TaskStatus | TaskStatus[];
  assignedTo?: string;
  scheduledDate?: string;
  scheduledDateFrom?: string;
  scheduledDateTo?: string;
  sourceModule?: SourceModule;
  taskType?: string;
};

// =============================================================================
// ROW MAPPING
// =============================================================================

type TaskRow = {
  id: string;
  org_id: string;
  source_module: string;
  source_ref_type: string | null;
  source_ref_id: string | null;
  title: string;
  description: string | null;
  task_type: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  assigned_team_id: string | null;
  assigned_team_name?: string | null;
  scheduled_date: string | null;
  priority: number;
  status: string;
  plant_quantity: number | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes?: number | null;
  plants_per_hour?: number | null;
  created_at: string;
  created_by: string | null;
  completed_by: string | null;
  updated_at: string;
};

function mapRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    orgId: row.org_id,
    sourceModule: row.source_module as SourceModule,
    sourceRefType: row.source_ref_type,
    sourceRefId: row.source_ref_id,
    title: row.title,
    description: row.description,
    taskType: row.task_type,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    assignedToEmail: row.assigned_to_email ?? null,
    assignedTeamId: row.assigned_team_id,
    assignedTeamName: row.assigned_team_name ?? null,
    scheduledDate: row.scheduled_date,
    priority: row.priority,
    status: row.status as TaskStatus,
    plantQuantity: row.plant_quantity,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMinutes: row.duration_minutes ?? null,
    plantsPerHour: row.plants_per_hour ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by,
    completedBy: row.completed_by,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all tasks for the organization with optional filters
 */
export async function getTasks(filter: TaskFilter = {}): Promise<Task[]> {
  const { supabase, orgId } = await getUserAndOrg();

  let query = supabase
    .from("tasks_with_productivity")
    .select("*")
    .eq("org_id", orgId)
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
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

  if (filter.scheduledDate) {
    query = query.eq("scheduled_date", filter.scheduledDate);
  }

  if (filter.scheduledDateFrom) {
    query = query.gte("scheduled_date", filter.scheduledDateFrom);
  }

  if (filter.scheduledDateTo) {
    query = query.lte("scheduled_date", filter.scheduledDateTo);
  }

  if (filter.sourceModule) {
    query = query.eq("source_module", filter.sourceModule);
  }

  if (filter.taskType) {
    query = query.eq("task_type", filter.taskType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[tasks/service] Error fetching tasks:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToTask);
}

/**
 * Get tasks for a specific employee's schedule
 */
export async function getEmployeeSchedule(
  userId: string,
  scheduledDate?: string
): Promise<Task[]> {
  const filter: TaskFilter = {
    assignedTo: userId,
    status: ["assigned", "in_progress"],
  };

  if (scheduledDate) {
    filter.scheduledDate = scheduledDate;
  }

  return getTasks(filter);
}

/**
 * Get a single task by ID
 */
export async function getTaskById(taskId: string): Promise<Task | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("tasks_with_productivity")
    .select("*")
    .eq("id", taskId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[tasks/service] Error fetching task:", error);
    throw new Error(error.message);
  }

  return mapRowToTask(data);
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { supabase, orgId, user } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id: orgId,
      source_module: input.sourceModule,
      source_ref_type: input.sourceRefType ?? null,
      source_ref_id: input.sourceRefId ?? null,
      title: input.title,
      description: input.description ?? null,
      task_type: input.taskType ?? null,
      assigned_to: input.assignedTo ?? null,
      assigned_team_id: input.assignedTeamId ?? null,
      scheduled_date: input.scheduledDate ?? null,
      priority: input.priority ?? 0,
      status: input.assignedTo || input.assignedTeamId ? "assigned" : "pending",
      plant_quantity: input.plantQuantity ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[tasks/service] Error creating task:", error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Task creation returned no data");
  }

  // Fetch from view to get joined fields (includes computed values like assignedToName)
  const task = await getTaskById(data.id);
  if (task) {
    return task;
  }

  // Fallback to raw insert data (won't have joined fields, but won't crash)
  return mapRowToTask({
    ...data,
    assigned_team_id: data.assigned_team_id ?? null,
    // These fields won't exist from insert, provide defaults
    assigned_to_name: null,
    assigned_to_email: null,
    assigned_team_name: null,
    duration_minutes: null,
    plants_per_hour: null,
  });
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  const { supabase, orgId } = await getUserAndOrg();

  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo;
  if (input.assignedTeamId !== undefined) updateData.assigned_team_id = input.assignedTeamId;
  if (input.scheduledDate !== undefined) updateData.scheduled_date = input.scheduledDate;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.plantQuantity !== undefined) updateData.plant_quantity = input.plantQuantity;

  const { data, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", taskId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[tasks/service] Error updating task:", error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Task ${taskId} not found or update returned no data`);
  }

  // Fetch from view to get joined fields
  const task = await getTaskById(taskId);
  if (task) {
    return task;
  }

  // Fallback to raw update data
  return mapRowToTask({
    ...data,
    assigned_team_id: data.assigned_team_id ?? null,
    assigned_to_name: null,
    assigned_to_email: null,
    assigned_team_name: null,
    duration_minutes: null,
    plants_per_hour: null,
  });
}

/**
 * Assign a task to an employee
 */
export async function assignTask(
  taskId: string,
  assignedTo: string,
  scheduledDate?: string
): Promise<Task> {
  const { supabase, orgId } = await getUserAndOrg();

  const updateData: Record<string, unknown> = {
    assigned_to: assignedTo,
    status: "assigned",
  };

  if (scheduledDate) {
    updateData.scheduled_date = scheduledDate;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", taskId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[tasks/service] Error assigning task:", error);
    throw new Error(error.message);
  }

  return mapRowToTask(data);
}

/**
 * Start a task (records started_at timestamp)
 */
export async function startTask(taskId: string): Promise<Task> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[tasks/service] Error starting task:", error);
    throw new Error(error.message);
  }

  return mapRowToTask(data);
}

/**
 * Complete a task (records completed_at and logs productivity)
 */
export async function completeTask(
  taskId: string,
  actualPlantQuantity?: number
): Promise<Task> {
  const { supabase, orgId, user } = await getUserAndOrg();

  // Fetch the task first to get started_at
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !existing) {
    throw new Error("Task not found");
  }

  const now = new Date().toISOString();
  const plantCount = actualPlantQuantity ?? existing.plant_quantity ?? 0;

  // Update the task
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: user.id,
      plant_quantity: plantCount,
    })
    .eq("id", taskId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[tasks/service] Error completing task:", error);
    throw new Error(error.message);
  }

  // Log productivity if we have plant count and started_at
  if (plantCount > 0 && existing.started_at) {
    const startedAt = new Date(existing.started_at);
    const completedAt = new Date(now);
    const durationMinutes = Math.round(
      (completedAt.getTime() - startedAt.getTime()) / 1000 / 60
    );

    if (durationMinutes > 0) {
      await supabase.from("productivity_logs").insert({
        org_id: orgId,
        user_id: user.id,
        task_id: taskId,
        task_type: existing.task_type ?? "unknown",
        plant_count: plantCount,
        duration_minutes: durationMinutes,
        machine: null,
        location: null,
      });
    }
  }

  return mapRowToTask(data);
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<Task> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "cancelled" })
    .eq("id", taskId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[tasks/service] Error cancelling task:", error);
    throw new Error(error.message);
  }

  return mapRowToTask(data);
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("org_id", orgId);

  if (error) {
    console.error("[tasks/service] Error deleting task:", error);
    throw new Error(error.message);
  }
}

/**
 * Get a task by its source reference (e.g., pick_list or job)
 */
export async function getTaskBySourceRef(
  sourceModule: SourceModule,
  sourceRefType: string,
  sourceRefId: string
): Promise<Task | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("tasks_with_productivity")
    .select("*")
    .eq("org_id", orgId)
    .eq("source_module", sourceModule)
    .eq("source_ref_type", sourceRefType)
    .eq("source_ref_id", sourceRefId)
    .maybeSingle();

  if (error) {
    // PGRST116 means no rows found - that's not an error, just no task exists
    if (error.code === "PGRST116") {
      return null;
    }
    // For real errors, throw so callers can handle appropriately
    console.error("[tasks/service] Error fetching task by source ref:", error);
    throw new Error(error.message);
  }

  return data ? mapRowToTask(data) : null;
}

/**
 * Delete task by source reference
 */
export async function deleteTaskBySourceRef(
  sourceModule: SourceModule,
  sourceRefType: string,
  sourceRefId: string
): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("org_id", orgId)
    .eq("source_module", sourceModule)
    .eq("source_ref_type", sourceRefType)
    .eq("source_ref_id", sourceRefId);

  if (error) {
    console.error("[tasks/service] Error deleting task by source ref:", error);
    throw new Error(error.message);
  }
}

// =============================================================================
// STAFF HELPERS
// =============================================================================

export type StaffMember = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
};

/**
 * Get org members who can be assigned tasks
 */
export async function getAssignableStaff(): Promise<StaffMember[]> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("org_memberships")
    .select("user_id, role, profiles(id, display_name, email)")
    .eq("org_id", orgId)
    .in("role", ["grower", "admin", "owner", "editor", "staff"]);

  if (error) {
    console.error("[tasks/service] Error fetching staff:", error);
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((m) => m.profiles)
    .map((m) => ({
      id: m.user_id,
      name: (m.profiles as { display_name?: string; email?: string })?.display_name ?? "Unknown",
      email: (m.profiles as { display_name?: string; email?: string })?.email ?? null,
      role: m.role,
    }));
}


