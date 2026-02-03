import "server-only";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";

// =============================================================================
// TYPES
// =============================================================================

export type WorksheetStatus = "open" | "completed";

export type ExecutionWorksheet = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  scheduledDate: string | null;
  status: WorksheetStatus;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
};

export type WorksheetBatch = {
  worksheetId: string;
  batchId: string;
  sortOrder: number;
  completedAt: string | null;
  completedBy: string | null;
  notes: string | null;
  addedAt: string;
  // Joined batch data
  batch?: {
    id: string;
    batchCode: string;
    plantVarietyName: string;
    status: string;
    quantity: number;
    sizeName: string | null;
  };
};

export type ExecutionWorksheetWithBatches = ExecutionWorksheet & {
  batches: WorksheetBatch[];
  progress: {
    total: number;
    completed: number;
  };
};

export type CreateWorksheetInput = {
  name: string;
  description?: string;
  scheduledDate?: string;
  batchIds: string[];
};

// =============================================================================
// ROW MAPPING
// =============================================================================

type WorksheetRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  scheduled_date: string | null;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
};

type WorksheetBatchRow = {
  worksheet_id: string;
  batch_id: string;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  added_at: string;
  batches?: {
    id: string;
    batch_code: string;
    status: string;
    quantity: number;
    plant_varieties: { name: string } | null;
    plant_sizes: { name: string } | null;
  };
};

function mapRowToWorksheet(row: WorksheetRow): ExecutionWorksheet {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    scheduledDate: row.scheduled_date,
    status: row.status as WorksheetStatus,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

function mapRowToWorksheetBatch(row: WorksheetBatchRow): WorksheetBatch {
  return {
    worksheetId: row.worksheet_id,
    batchId: row.batch_id,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    notes: row.notes,
    addedAt: row.added_at,
    batch: row.batches
      ? {
          id: row.batches.id,
          batchCode: row.batches.batch_code,
          plantVarietyName: row.batches.plant_varieties?.name ?? "Unknown",
          status: row.batches.status,
          quantity: row.batches.quantity,
          sizeName: row.batches.plant_sizes?.name ?? null,
        }
      : undefined,
  };
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all execution worksheets for the organization.
 * Includes progress (completed/total counts).
 */
export async function getExecutionWorksheets(
  options: { status?: WorksheetStatus } = {}
): Promise<ExecutionWorksheetWithBatches[]> {
  const { supabase, orgId } = await getUserAndOrg();

  let query = supabase
    .from("execution_worksheets")
    .select(
      `
      *,
      execution_worksheet_batches(
        worksheet_id,
        batch_id,
        sort_order,
        completed_at,
        completed_by,
        notes,
        added_at,
        batches(
          id,
          batch_code,
          status,
          quantity,
          plant_varieties(name),
          plant_sizes(name)
        )
      )
    `
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    logError("[execution-worksheets] Error fetching worksheets", {
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const worksheet = mapRowToWorksheet(row as WorksheetRow);
    const batchRows = (row.execution_worksheet_batches ?? []) as WorksheetBatchRow[];
    const batches = batchRows.map(mapRowToWorksheetBatch);
    const completed = batches.filter((b) => b.completedAt !== null).length;

    return {
      ...worksheet,
      batches,
      progress: {
        total: batches.length,
        completed,
      },
    };
  });
}

/**
 * Get open (in-progress) worksheets only.
 */
export async function getOpenWorksheets(): Promise<ExecutionWorksheetWithBatches[]> {
  return getExecutionWorksheets({ status: "open" });
}

/**
 * Get a single execution worksheet by ID with all batch details.
 */
export async function getExecutionWorksheetById(
  worksheetId: string
): Promise<ExecutionWorksheetWithBatches | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("execution_worksheets")
    .select(
      `
      *,
      execution_worksheet_batches(
        worksheet_id,
        batch_id,
        sort_order,
        completed_at,
        completed_by,
        notes,
        added_at,
        batches(
          id,
          batch_code,
          status,
          quantity,
          plant_varieties(name),
          plant_sizes(name)
        )
      )
    `
    )
    .eq("id", worksheetId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logError("[execution-worksheets] Error fetching worksheet", {
      error: error.message,
      worksheetId,
    });
    throw new Error(error.message);
  }

  const worksheet = mapRowToWorksheet(data as WorksheetRow);
  const batchRows = (data.execution_worksheet_batches ?? []) as WorksheetBatchRow[];
  const batches = batchRows.map(mapRowToWorksheetBatch);
  const completed = batches.filter((b) => b.completedAt !== null).length;

  return {
    ...worksheet,
    batches,
    progress: {
      total: batches.length,
      completed,
    },
  };
}

/**
 * Get worksheet progress (completed/total counts).
 */
export async function getWorksheetProgress(
  worksheetId: string
): Promise<{ total: number; completed: number } | null> {
  const { supabase, orgId } = await getUserAndOrg();

  // First verify the worksheet belongs to this org
  const { data: worksheet, error: worksheetError } = await supabase
    .from("execution_worksheets")
    .select("id")
    .eq("id", worksheetId)
    .eq("org_id", orgId)
    .single();

  if (worksheetError || !worksheet) {
    if (worksheetError?.code === "PGRST116") return null;
    logError("[execution-worksheets] Error verifying worksheet ownership", {
      error: worksheetError?.message,
      worksheetId,
    });
    return null;
  }

  const { data, error } = await supabase
    .from("execution_worksheet_batches")
    .select("completed_at")
    .eq("worksheet_id", worksheetId);

  if (error) {
    logError("[execution-worksheets] Error fetching worksheet progress", {
      error: error.message,
      worksheetId,
    });
    throw new Error(error.message);
  }

  const total = data?.length ?? 0;
  const completed = data?.filter((b) => b.completed_at !== null).length ?? 0;

  return { total, completed };
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new execution worksheet with batch associations.
 */
export async function createExecutionWorksheet(
  input: CreateWorksheetInput
): Promise<ExecutionWorksheetWithBatches> {
  const { supabase, orgId, user } = await getUserAndOrg();

  // Validate that all batch IDs belong to this org
  if (input.batchIds.length > 0) {
    const { data: validBatches, error: batchError } = await supabase
      .from("batches")
      .select("id")
      .eq("org_id", orgId)
      .in("id", input.batchIds);

    if (batchError) {
      logError("[execution-worksheets] Error validating batch IDs", {
        error: batchError.message,
      });
      throw new Error(batchError.message);
    }

    if ((validBatches?.length ?? 0) !== input.batchIds.length) {
      throw new Error("One or more batch IDs are invalid or belong to another organization");
    }
  }

  // Create the worksheet
  const { data: worksheet, error: worksheetError } = await supabase
    .from("execution_worksheets")
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description ?? null,
      scheduled_date: input.scheduledDate ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (worksheetError) {
    logError("[execution-worksheets] Error creating worksheet", {
      error: worksheetError.message,
    });
    throw new Error(worksheetError.message);
  }

  // Create batch associations
  if (input.batchIds.length > 0) {
    const batchInserts = input.batchIds.map((batchId, index) => ({
      worksheet_id: worksheet.id,
      batch_id: batchId,
      sort_order: index,
    }));

    const { error: batchInsertError } = await supabase
      .from("execution_worksheet_batches")
      .insert(batchInserts);

    if (batchInsertError) {
      logError("[execution-worksheets] Error adding batches to worksheet", {
        error: batchInsertError.message,
        worksheetId: worksheet.id,
      });
      // Clean up the worksheet we just created
      await supabase.from("execution_worksheets").delete().eq("id", worksheet.id);
      throw new Error(batchInsertError.message);
    }
  }

  // Fetch and return the complete worksheet
  const result = await getExecutionWorksheetById(worksheet.id);
  if (!result) {
    throw new Error("Failed to retrieve created worksheet");
  }

  return result;
}

/**
 * Delete an execution worksheet.
 * The CASCADE will automatically delete associated batch entries.
 */
export async function deleteExecutionWorksheet(worksheetId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("execution_worksheets")
    .delete()
    .eq("id", worksheetId)
    .eq("org_id", orgId);

  if (error) {
    logError("[execution-worksheets] Error deleting worksheet", {
      error: error.message,
      worksheetId,
    });
    throw new Error(error.message);
  }
}

/**
 * Manually mark a worksheet as completed.
 * Normally this happens automatically via trigger when all batches are actualized.
 */
export async function completeWorksheet(worksheetId: string): Promise<ExecutionWorksheet> {
  const { supabase, orgId, user } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("execution_worksheets")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", worksheetId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[execution-worksheets] Error completing worksheet", {
      error: error.message,
      worksheetId,
    });
    throw new Error(error.message);
  }

  return mapRowToWorksheet(data);
}

/**
 * Reopen a completed worksheet.
 */
export async function reopenWorksheet(worksheetId: string): Promise<ExecutionWorksheet> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("execution_worksheets")
    .update({
      status: "open",
      completed_at: null,
      completed_by: null,
    })
    .eq("id", worksheetId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[execution-worksheets] Error reopening worksheet", {
      error: error.message,
      worksheetId,
    });
    throw new Error(error.message);
  }

  return mapRowToWorksheet(data);
}

/**
 * Update notes for a specific batch in a worksheet.
 */
export async function updateWorksheetBatchNotes(
  worksheetId: string,
  batchId: string,
  notes: string | null
): Promise<WorksheetBatch> {
  const { supabase, orgId } = await getUserAndOrg();

  // Verify worksheet belongs to org
  const { data: worksheet, error: worksheetError } = await supabase
    .from("execution_worksheets")
    .select("id")
    .eq("id", worksheetId)
    .eq("org_id", orgId)
    .single();

  if (worksheetError || !worksheet) {
    throw new Error("Worksheet not found or access denied");
  }

  const { data, error } = await supabase
    .from("execution_worksheet_batches")
    .update({ notes })
    .eq("worksheet_id", worksheetId)
    .eq("batch_id", batchId)
    .select("*")
    .single();

  if (error) {
    logError("[execution-worksheets] Error updating batch notes", {
      error: error.message,
      worksheetId,
      batchId,
    });
    throw new Error(error.message);
  }

  return mapRowToWorksheetBatch(data);
}
