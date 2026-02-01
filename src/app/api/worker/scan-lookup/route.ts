import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";
import { parseScanCode, candidateBatchNumbers, parseMaterialScanCode } from "@/lib/scan/parse";
import type { Task, TaskStatus } from "@/server/tasks/service";
import type {
  WorkerTask,
  ProductionContext,
  DispatchContext,
  PlantHealthContext,
} from "@/lib/types/worker-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  code: z.string().min(1, "Scan code is required"),
});

/**
 * Batch info returned when a batch is scanned
 */
interface BatchInfo {
  id: string;
  batchNumber: string | null;
  varietyName: string | null;
}

/**
 * Material info returned when a material is scanned
 */
interface MaterialInfo {
  id: string;
  partNumber: string;
  name: string;
  categoryName: string | null;
  totalStock: number;
  uom: string;
}

/**
 * Response from scan lookup
 */
interface ScanLookupResponse {
  found: boolean;
  task?: WorkerTask;
  suggestions?: WorkerTask[];
  batch?: BatchInfo;
  material?: MaterialInfo;
  message?: string;
}

/**
 * POST /api/worker/scan-lookup
 * Looks up tasks based on a scanned barcode
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Parse request body
    const body = await req.json();
    const { code } = RequestSchema.parse(body);

    // Parse the scanned code
    const parsed = parseScanCode(code);

    if (!parsed) {
      return NextResponse.json<ScanLookupResponse>({
        found: false,
        message: "Could not recognize this barcode format",
      });
    }

    // Handle different code types
    switch (parsed.by) {
      case "materialPartNumber":
      case "materialBarcode": {
        // Material lookup - redirect to material detail
        const material = await lookupMaterial(
          supabase,
          orgId,
          parsed.by === "materialPartNumber" ? "partNumber" : "barcode",
          parsed.value
        );
        if (material) {
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            material,
            message: `Found material: ${material.name}`,
          });
        }
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          message: "Material not found",
        });
      }

      case "lotNumber":
      case "lotBarcode": {
        // Material lot lookup - find the material for this lot
        const material = await lookupMaterialByLot(
          supabase,
          orgId,
          parsed.value
        );
        if (material) {
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            material,
            message: `Found lot for: ${material.name}`,
          });
        }
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          message: "Lot not found",
        });
      }

      case "taskId": {
        // Direct task lookup
        const task = await lookupTaskById(supabase, orgId, parsed.value);
        if (task) {
          const enriched = await enrichTask(supabase, orgId, task);
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            task: enriched,
          });
        }
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          message: "Task not found or already completed",
        });
      }

      case "batchNumber": {
        // Find tasks related to this batch
        const candidates = candidateBatchNumbers(parsed.value);
        const { batch, tasks } = await lookupByBatchNumber(
          supabase,
          orgId,
          user.id,
          candidates
        );

        if (tasks.length === 0) {
          return NextResponse.json<ScanLookupResponse>({
            found: false,
            batch: batch ?? undefined,
            message: batch
              ? `No pending tasks for batch ${batch.batchNumber}`
              : "Batch not found",
          });
        }

        if (tasks.length === 1) {
          const enriched = await enrichTask(supabase, orgId, tasks[0]);
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            task: enriched,
            batch: batch ?? undefined,
          });
        }

        // Multiple tasks - return as suggestions (batch fetch to avoid N+1)
        const enrichedTasks = await enrichTasksBatch(supabase, orgId, tasks);
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          suggestions: enrichedTasks,
          batch: batch ?? undefined,
          message: `Found ${tasks.length} tasks for this batch`,
        });
      }

      case "locationId": {
        // Find tasks at this location
        const tasks = await lookupByLocation(
          supabase,
          orgId,
          user.id,
          parsed.value
        );

        if (tasks.length === 0) {
          return NextResponse.json<ScanLookupResponse>({
            found: false,
            message: "No pending tasks at this location",
          });
        }

        if (tasks.length === 1) {
          const enriched = await enrichTask(supabase, orgId, tasks[0]);
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            task: enriched,
          });
        }

        // Multiple tasks - return as suggestions (batch fetch to avoid N+1)
        const enrichedTasks = await enrichTasksBatch(supabase, orgId, tasks);
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          suggestions: enrichedTasks,
          message: `Found ${tasks.length} tasks at this location`,
        });
      }

      case "id": {
        // UUID - could be task ID or batch ID
        // Try task first
        const task = await lookupTaskById(supabase, orgId, parsed.value);
        if (task) {
          const enriched = await enrichTask(supabase, orgId, task);
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            task: enriched,
          });
        }

        // Try as batch ID
        const { batch, tasks } = await lookupByBatchId(
          supabase,
          orgId,
          user.id,
          parsed.value
        );

        if (tasks.length === 0) {
          return NextResponse.json<ScanLookupResponse>({
            found: false,
            batch: batch ?? undefined,
            message: batch
              ? `No pending tasks for batch ${batch.batchNumber}`
              : "No task found for this code",
          });
        }

        if (tasks.length === 1) {
          const enriched = await enrichTask(supabase, orgId, tasks[0]);
          return NextResponse.json<ScanLookupResponse>({
            found: true,
            task: enriched,
            batch: batch ?? undefined,
          });
        }

        // Batch fetch to avoid N+1
        const enrichedTasks = await enrichTasksBatch(supabase, orgId, tasks);
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          suggestions: enrichedTasks,
          batch: batch ?? undefined,
          message: `Found ${tasks.length} tasks for this batch`,
        });
      }

      default:
        return NextResponse.json<ScanLookupResponse>({
          found: false,
          message: "This barcode type is not supported for task lookup",
        });
    }
  } catch (error) {
    logError("[api/worker/scan-lookup] Error", { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to process scan";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// =============================================================================
// LOOKUP HELPERS
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
    sourceModule: row.source_module as Task["sourceModule"],
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

/**
 * Lookup a task directly by ID
 */
async function lookupTaskById(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  taskId: string
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks_with_productivity")
    .select("*")
    .eq("id", taskId)
    .eq("org_id", orgId)
    .in("status", ["pending", "assigned", "in_progress"])
    .single();

  if (error || !data) return null;
  return mapRowToTask(data);
}

/**
 * Lookup tasks by batch number (searches job_batches and ipm_task_batches)
 */
async function lookupByBatchNumber(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  userId: string,
  candidates: string[]
): Promise<{ batch: BatchInfo | null; tasks: Task[] }> {
  // First find the batch
  const { data: batchData } = await supabase
    .from("batches")
    .select("id, batch_number, varieties!batches_variety_id_fkey(name)")
    .eq("org_id", orgId)
    .in("batch_number", candidates)
    .limit(1)
    .single();

  if (!batchData) {
    // Also try matching on stripped version of batch_number
    const { data: batchDataAlt } = await supabase
      .from("batches")
      .select("id, batch_number, varieties!batches_variety_id_fkey(name)")
      .eq("org_id", orgId)
      .limit(100);

    // Manual fuzzy match
    const match = (batchDataAlt ?? []).find((b) =>
      candidates.some(
        (c) =>
          b.batch_number === c ||
          b.batch_number?.replace(/\D/g, "") === c ||
          c === b.batch_number?.replace(/\D/g, "")
      )
    );

    if (!match) {
      return { batch: null, tasks: [] };
    }

    return lookupByBatchId(supabase, orgId, userId, match.id);
  }

  return lookupByBatchId(supabase, orgId, userId, batchData.id);
}

/**
 * Lookup tasks by batch ID
 */
async function lookupByBatchId(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  userId: string,
  batchId: string
): Promise<{ batch: BatchInfo | null; tasks: Task[] }> {
  // Get batch info
  const { data: batchData } = await supabase
    .from("batches")
    .select("id, batch_number, varieties!batches_variety_id_fkey(name)")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .single();

  const batch: BatchInfo | null = batchData
    ? {
        id: batchData.id,
        batchNumber: batchData.batch_number,
        varietyName:
          (batchData.varieties as unknown as { name: string } | null)?.name ??
          null,
      }
    : null;

  if (!batchData) {
    return { batch: null, tasks: [] };
  }

  // Find job IDs that include this batch
  const { data: jobBatches } = await supabase
    .from("job_batches")
    .select("job_id")
    .eq("batch_id", batchId);

  // Find IPM task IDs that include this batch
  const { data: ipmBatches } = await supabase
    .from("ipm_task_batches")
    .select("ipm_task_id")
    .eq("batch_id", batchId);

  const jobIds = (jobBatches ?? []).map((jb) => jb.job_id);
  const ipmTaskIds = (ipmBatches ?? []).map((ib) => ib.ipm_task_id);

  if (jobIds.length === 0 && ipmTaskIds.length === 0) {
    return { batch, tasks: [] };
  }

  // Find tasks for these jobs/IPM tasks
  let query = supabase
    .from("tasks_with_productivity")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["pending", "assigned", "in_progress"]);

  // Build OR conditions for source refs
  const orConditions: string[] = [];
  if (jobIds.length > 0) {
    orConditions.push(`source_ref_id.in.(${jobIds.join(",")})`);
  }
  if (ipmTaskIds.length > 0) {
    orConditions.push(`source_ref_id.in.(${ipmTaskIds.join(",")})`);
  }

  if (orConditions.length > 0) {
    query = query.or(orConditions.join(","));
  }

  // Prefer tasks assigned to this user, then unassigned, then others
  query = query
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: taskRows, error } = await query;

  if (error) {
    logError("[scan-lookup] Error fetching tasks by batch", { error });
    return { batch, tasks: [] };
  }

  // Sort to prioritize user's own tasks
  const tasks = (taskRows ?? [])
    .map(mapRowToTask)
    .sort((a, b) => {
      // User's tasks first
      if (a.assignedTo === userId && b.assignedTo !== userId) return -1;
      if (a.assignedTo !== userId && b.assignedTo === userId) return 1;
      // Then unassigned
      if (!a.assignedTo && b.assignedTo) return -1;
      if (a.assignedTo && !b.assignedTo) return 1;
      return 0;
    });

  return { batch, tasks };
}

/**
 * Lookup tasks by location
 */
async function lookupByLocation(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  userId: string,
  locationId: string
): Promise<Task[]> {
  // Find jobs at this location
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("location_id", locationId)
    .in("status", ["pending", "in_progress"]);

  const jobIds = (jobs ?? []).map((j) => j.id);

  if (jobIds.length === 0) {
    return [];
  }

  // Find tasks for these jobs
  const { data: taskRows, error } = await supabase
    .from("tasks_with_productivity")
    .select("*")
    .eq("org_id", orgId)
    .in("source_ref_id", jobIds)
    .in("status", ["pending", "assigned", "in_progress"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logError("[scan-lookup] Error fetching tasks by location", { error });
    return [];
  }

  // Sort to prioritize user's own tasks
  return (taskRows ?? [])
    .map(mapRowToTask)
    .sort((a, b) => {
      if (a.assignedTo === userId && b.assignedTo !== userId) return -1;
      if (a.assignedTo !== userId && b.assignedTo === userId) return 1;
      if (!a.assignedTo && b.assignedTo) return -1;
      if (a.assignedTo && !b.assignedTo) return 1;
      return 0;
    });
}

// =============================================================================
// CONTEXT ENRICHMENT
// =============================================================================

/**
 * Enrich a task with module-specific context (single task)
 */
async function enrichTask(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  task: Task
): Promise<WorkerTask> {
  if (!task.sourceRefId) {
    return task;
  }

  let moduleContext: WorkerTask["moduleContext"];

  switch (task.sourceModule) {
    case "production": {
      const context = await fetchProductionContext(
        supabase,
        orgId,
        task.sourceRefId
      );
      if (context) moduleContext = context;
      break;
    }
    case "dispatch": {
      const context = await fetchDispatchContext(
        supabase,
        orgId,
        task.sourceRefId
      );
      if (context) moduleContext = context;
      break;
    }
    case "plant_health": {
      const context = await fetchPlantHealthContext(
        supabase,
        orgId,
        task.sourceRefId
      );
      if (context) moduleContext = context;
      break;
    }
  }

  return { ...task, moduleContext };
}

/**
 * Batch enrich multiple tasks - fetches all context data in parallel
 * to avoid N+1 queries when enriching multiple tasks
 */
async function enrichTasksBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  tasks: Task[]
): Promise<WorkerTask[]> {
  if (tasks.length === 0) return [];

  // For single task, use the existing function
  if (tasks.length === 1) {
    return [await enrichTask(supabase, orgId, tasks[0])];
  }

  // Group tasks by module type to batch fetch
  const productionJobIds: string[] = [];
  const dispatchPickListIds: string[] = [];
  const plantHealthIpmIds: string[] = [];

  for (const task of tasks) {
    if (!task.sourceRefId) continue;
    switch (task.sourceModule) {
      case "production":
        productionJobIds.push(task.sourceRefId);
        break;
      case "dispatch":
        dispatchPickListIds.push(task.sourceRefId);
        break;
      case "plant_health":
        plantHealthIpmIds.push(task.sourceRefId);
        break;
    }
  }

  // Batch fetch all contexts in parallel
  const [productionContexts, dispatchContexts, plantHealthContexts] = await Promise.all([
    productionJobIds.length > 0
      ? fetchProductionContextsBatch(supabase, orgId, productionJobIds)
      : Promise.resolve(new Map<string, ProductionContext>()),
    dispatchPickListIds.length > 0
      ? fetchDispatchContextsBatch(supabase, orgId, dispatchPickListIds)
      : Promise.resolve(new Map<string, DispatchContext>()),
    plantHealthIpmIds.length > 0
      ? fetchPlantHealthContextsBatch(supabase, orgId, plantHealthIpmIds)
      : Promise.resolve(new Map<string, PlantHealthContext>()),
  ]);

  // Map contexts back to tasks
  return tasks.map((task) => {
    if (!task.sourceRefId) return task;

    let moduleContext: WorkerTask["moduleContext"];
    switch (task.sourceModule) {
      case "production":
        moduleContext = productionContexts.get(task.sourceRefId);
        break;
      case "dispatch":
        moduleContext = dispatchContexts.get(task.sourceRefId);
        break;
      case "plant_health":
        moduleContext = plantHealthContexts.get(task.sourceRefId);
        break;
    }

    return { ...task, moduleContext };
  });
}

/**
 * Batch fetch production contexts for multiple job IDs
 */
async function fetchProductionContextsBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  jobIds: string[]
): Promise<Map<string, ProductionContext>> {
  const result = new Map<string, ProductionContext>();
  if (jobIds.length === 0) return result;

  try {
    // Fetch all jobs in one query
    const { data: jobs } = await supabase
      .from("jobs")
      .select(`
        id,
        name,
        process_type,
        location_id,
        locations!jobs_location_id_fkey(name)
      `)
      .in("id", jobIds)
      .eq("org_id", orgId);

    // Fetch batch counts for all jobs in one query
    const { data: batchCounts } = await supabase
      .from("job_batches")
      .select("job_id")
      .in("job_id", jobIds);

    // Count batches per job
    const countMap = new Map<string, number>();
    for (const jb of batchCounts ?? []) {
      countMap.set(jb.job_id, (countMap.get(jb.job_id) ?? 0) + 1);
    }

    // Build result map
    for (const job of jobs ?? []) {
      const location = job.locations as unknown as { name: string } | null;
      result.set(job.id, {
        type: "production",
        jobName: job.name || undefined,
        processType: job.process_type || undefined,
        batchCount: countMap.get(job.id) ?? 0,
        location: location?.name || undefined,
      });
    }
  } catch {
    // Return empty map on error
  }

  return result;
}

/**
 * Batch fetch dispatch contexts for multiple pick list IDs
 */
async function fetchDispatchContextsBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  pickListIds: string[]
): Promise<Map<string, DispatchContext>> {
  const result = new Map<string, DispatchContext>();
  if (pickListIds.length === 0) return result;

  try {
    const { data: pickLists } = await supabase
      .from("pick_lists")
      .select(`
        id,
        items_total,
        items_picked,
        orders!pick_lists_order_id_fkey(
          order_number,
          customers!orders_customer_id_fkey(company_name)
        )
      `)
      .in("id", pickListIds)
      .eq("org_id", orgId);

    for (const pickList of pickLists ?? []) {
      const order = pickList.orders as unknown as {
        order_number: string;
        customers: { company_name: string } | null;
      } | null;

      result.set(pickList.id, {
        type: "dispatch",
        orderNumber: order?.order_number || undefined,
        customerName: order?.customers?.company_name || undefined,
        itemsTotal: pickList.items_total ?? 0,
        itemsPicked: pickList.items_picked ?? 0,
      });
    }
  } catch {
    // Return empty map on error
  }

  return result;
}

/**
 * Batch fetch plant health contexts for multiple IPM task IDs
 */
async function fetchPlantHealthContextsBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  ipmTaskIds: string[]
): Promise<Map<string, PlantHealthContext>> {
  const result = new Map<string, PlantHealthContext>();
  if (ipmTaskIds.length === 0) return result;

  try {
    // Fetch all IPM tasks in one query
    const { data: ipmTasks } = await supabase
      .from("ipm_tasks")
      .select(`
        id,
        method,
        products!ipm_tasks_product_id_fkey(name)
      `)
      .in("id", ipmTaskIds)
      .eq("org_id", orgId);

    // Fetch batch counts for all IPM tasks in one query
    const { data: batchCounts } = await supabase
      .from("ipm_task_batches")
      .select("ipm_task_id")
      .in("ipm_task_id", ipmTaskIds);

    // Count batches per IPM task
    const countMap = new Map<string, number>();
    for (const tb of batchCounts ?? []) {
      countMap.set(tb.ipm_task_id, (countMap.get(tb.ipm_task_id) ?? 0) + 1);
    }

    // Build result map
    for (const ipmTask of ipmTasks ?? []) {
      const product = ipmTask.products as unknown as { name: string } | null;
      result.set(ipmTask.id, {
        type: "plant_health",
        productName: product?.name || undefined,
        methodName: ipmTask.method || undefined,
        batchCount: countMap.get(ipmTask.id) ?? 0,
      });
    }
  } catch {
    // Return empty map on error
  }

  return result;
}

async function fetchProductionContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  jobId: string
): Promise<ProductionContext | null> {
  try {
    const { data: job } = await supabase
      .from("jobs")
      .select(
        `
        id,
        name,
        process_type,
        location_id,
        locations!jobs_location_id_fkey(name)
      `
      )
      .eq("id", jobId)
      .eq("org_id", orgId)
      .single();

    if (!job) return null;

    const { count } = await supabase
      .from("job_batches")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId);

    const location = job.locations as unknown as { name: string } | null;

    return {
      type: "production",
      jobName: job.name || undefined,
      processType: job.process_type || undefined,
      batchCount: count ?? 0,
      location: location?.name || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchDispatchContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  pickListId: string
): Promise<DispatchContext | null> {
  try {
    const { data: pickList } = await supabase
      .from("pick_lists")
      .select(
        `
        id,
        items_total,
        items_picked,
        orders!pick_lists_order_id_fkey(
          order_number,
          customers!orders_customer_id_fkey(company_name)
        )
      `
      )
      .eq("id", pickListId)
      .eq("org_id", orgId)
      .single();

    if (!pickList) return null;

    const order = pickList.orders as unknown as {
      order_number: string;
      customers: { company_name: string } | null;
    } | null;

    return {
      type: "dispatch",
      orderNumber: order?.order_number || undefined,
      customerName: order?.customers?.company_name || undefined,
      itemsTotal: pickList.items_total ?? 0,
      itemsPicked: pickList.items_picked ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchPlantHealthContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  ipmTaskId: string
): Promise<PlantHealthContext | null> {
  try {
    const { data: ipmTask } = await supabase
      .from("ipm_tasks")
      .select(
        `
        id,
        method,
        products!ipm_tasks_product_id_fkey(name)
      `
      )
      .eq("id", ipmTaskId)
      .eq("org_id", orgId)
      .single();

    if (!ipmTask) return null;

    const { count } = await supabase
      .from("ipm_task_batches")
      .select("ipm_task_id", { count: "exact", head: true })
      .eq("ipm_task_id", ipmTaskId);

    const product = ipmTask.products as unknown as { name: string } | null;

    return {
      type: "plant_health",
      productName: product?.name || undefined,
      methodName: ipmTask.method || undefined,
      batchCount: count ?? 0,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// MATERIAL LOOKUP HELPERS
// =============================================================================

/**
 * Lookup material by part number or barcode
 */
async function lookupMaterial(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  searchBy: "partNumber" | "barcode",
  value: string
): Promise<MaterialInfo | null> {
  try {
    let query = supabase
      .from("materials")
      .select(`
        id,
        part_number,
        name,
        base_uom,
        material_categories!materials_category_id_fkey(name)
      `)
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (searchBy === "partNumber") {
      query = query.eq("part_number", value);
    } else {
      query = query.eq("barcode", value);
    }

    const { data: material, error } = await query.single();

    if (error || !material) return null;

    // Get total stock
    const { data: stockData } = await supabase
      .from("material_lots")
      .select("quantity")
      .eq("material_id", material.id)
      .eq("status", "available");

    const totalStock = (stockData ?? []).reduce(
      (sum, lot) => sum + (lot.quantity ?? 0),
      0
    );

    const category = material.material_categories as unknown as { name: string } | null;

    return {
      id: material.id,
      partNumber: material.part_number,
      name: material.name,
      categoryName: category?.name ?? null,
      totalStock,
      uom: material.base_uom,
    };
  } catch {
    return null;
  }
}

/**
 * Lookup material by lot number
 */
async function lookupMaterialByLot(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  lotNumber: string
): Promise<MaterialInfo | null> {
  try {
    const { data: lot, error } = await supabase
      .from("material_lots")
      .select(`
        material_id,
        materials!material_lots_material_id_fkey(
          id,
          part_number,
          name,
          base_uom,
          material_categories!materials_category_id_fkey(name)
        )
      `)
      .eq("lot_number", lotNumber)
      .single();

    if (error || !lot) return null;

    const material = lot.materials as unknown as {
      id: string;
      part_number: string;
      name: string;
      base_uom: string;
      material_categories: { name: string } | null;
    } | null;

    if (!material) return null;

    // Get total stock for this material
    const { data: stockData } = await supabase
      .from("material_lots")
      .select("quantity")
      .eq("material_id", material.id)
      .eq("status", "available");

    const totalStock = (stockData ?? []).reduce(
      (sum, lot) => sum + (lot.quantity ?? 0),
      0
    );

    return {
      id: material.id,
      partNumber: material.part_number,
      name: material.name,
      categoryName: material.material_categories?.name ?? null,
      totalStock,
      uom: material.base_uom,
    };
  } catch {
    return null;
  }
}
