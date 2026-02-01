import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";
import type { Task, TaskStatus } from "@/server/tasks/service";
import type {
  WorkerTask,
  ProductionContext,
  DispatchContext,
  PlantHealthContext,
} from "@/lib/types/worker-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
});

/**
 * GET /api/worker/search-tasks
 * Searches for tasks by title, description, or related batch number
 */
export async function GET(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Parse query params
    const url = new URL(req.url);
    const { q: query } = QuerySchema.parse({
      q: url.searchParams.get("q"),
    });

    const searchTerm = query.trim().toLowerCase();

    // Search for tasks directly matching title/description
    const { data: directTasks, error: directError } = await supabase
      .from("tasks_with_productivity")
      .select("*")
      .eq("org_id", orgId)
      .in("status", ["pending", "assigned", "in_progress"])
      .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (directError) {
      logError("[api/worker/search-tasks] Direct search error", {
        error: directError,
      });
    }

    // Search for batches matching the query
    const { data: matchingBatches } = await supabase
      .from("batches")
      .select("id, batch_number")
      .eq("org_id", orgId)
      .or(`batch_number.ilike.%${searchTerm}%`)
      .limit(10);

    const batchIds = (matchingBatches ?? []).map((b) => b.id);

    // Find tasks related to matching batches
    let batchRelatedTasks: Task[] = [];
    if (batchIds.length > 0) {
      // Get job IDs for these batches
      const { data: jobBatches } = await supabase
        .from("job_batches")
        .select("job_id")
        .in("batch_id", batchIds);

      // Get IPM task IDs for these batches
      const { data: ipmBatches } = await supabase
        .from("ipm_task_batches")
        .select("ipm_task_id")
        .in("batch_id", batchIds);

      const jobIds = [...new Set((jobBatches ?? []).map((jb) => jb.job_id))];
      const ipmTaskIds = [
        ...new Set((ipmBatches ?? []).map((ib) => ib.ipm_task_id)),
      ];

      const refIds = [...jobIds, ...ipmTaskIds];

      if (refIds.length > 0) {
        const { data: relatedTasks, error: relatedError } = await supabase
          .from("tasks_with_productivity")
          .select("*")
          .eq("org_id", orgId)
          .in("source_ref_id", refIds)
          .in("status", ["pending", "assigned", "in_progress"])
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20);

        if (relatedError) {
          logError("[api/worker/search-tasks] Related search error", {
            error: relatedError,
          });
        }

        batchRelatedTasks = (relatedTasks ?? []).map(mapRowToTask);
      }
    }

    // Merge and deduplicate results
    const directTasksMapped = (directTasks ?? []).map(mapRowToTask);
    const allTasks = [...directTasksMapped];

    // Add batch-related tasks that aren't already in direct results
    for (const task of batchRelatedTasks) {
      if (!allTasks.some((t) => t.id === task.id)) {
        allTasks.push(task);
      }
    }

    // Sort to prioritize:
    // 1. User's own tasks
    // 2. In-progress tasks
    // 3. Higher priority tasks
    const sortedTasks = allTasks.sort((a, b) => {
      // User's tasks first
      if (a.assignedTo === user.id && b.assignedTo !== user.id) return -1;
      if (a.assignedTo !== user.id && b.assignedTo === user.id) return 1;

      // In-progress tasks next
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (a.status !== "in_progress" && b.status === "in_progress") return 1;

      // Then by priority
      return b.priority - a.priority;
    });

    // Limit results
    const limitedTasks = sortedTasks.slice(0, 20);

    // Enrich tasks with context
    const enrichedTasks = await enrichTasks(supabase, orgId, limitedTasks);

    return NextResponse.json({
      tasks: enrichedTasks,
      total: sortedTasks.length,
    });
  } catch (error) {
    logError("[api/worker/search-tasks] Error", { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to search tasks";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// =============================================================================
// HELPERS
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

async function enrichTasks(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  tasks: Task[]
): Promise<WorkerTask[]> {
  // Group by source module for batch fetching
  const productionRefs: string[] = [];
  const dispatchRefs: string[] = [];
  const plantHealthRefs: string[] = [];

  for (const task of tasks) {
    if (!task.sourceRefId) continue;
    switch (task.sourceModule) {
      case "production":
        productionRefs.push(task.sourceRefId);
        break;
      case "dispatch":
        dispatchRefs.push(task.sourceRefId);
        break;
      case "plant_health":
        plantHealthRefs.push(task.sourceRefId);
        break;
    }
  }

  const [productionCtx, dispatchCtx, plantHealthCtx] = await Promise.all([
    fetchProductionContextBatch(supabase, orgId, productionRefs),
    fetchDispatchContextBatch(supabase, orgId, dispatchRefs),
    fetchPlantHealthContextBatch(supabase, orgId, plantHealthRefs),
  ]);

  return tasks.map((task): WorkerTask => {
    let moduleContext: WorkerTask["moduleContext"];

    if (task.sourceRefId) {
      switch (task.sourceModule) {
        case "production":
          moduleContext = productionCtx.get(task.sourceRefId);
          break;
        case "dispatch":
          moduleContext = dispatchCtx.get(task.sourceRefId);
          break;
        case "plant_health":
          moduleContext = plantHealthCtx.get(task.sourceRefId);
          break;
      }
    }

    return { ...task, moduleContext };
  });
}

async function fetchProductionContextBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  jobIds: string[]
): Promise<Map<string, ProductionContext>> {
  const map = new Map<string, ProductionContext>();
  if (jobIds.length === 0) return map;

  try {
    const { data: jobs } = await supabase
      .from("jobs")
      .select(
        `id, name, process_type, locations!jobs_location_id_fkey(name)`
      )
      .eq("org_id", orgId)
      .in("id", jobIds);

    const { data: batchCounts } = await supabase
      .from("job_batches")
      .select("job_id")
      .in("job_id", jobIds);

    const countMap = new Map<string, number>();
    for (const jb of batchCounts ?? []) {
      countMap.set(jb.job_id, (countMap.get(jb.job_id) ?? 0) + 1);
    }

    for (const job of jobs ?? []) {
      const location = job.locations as unknown as { name: string } | null;
      map.set(job.id, {
        type: "production",
        jobName: job.name || undefined,
        processType: job.process_type || undefined,
        batchCount: countMap.get(job.id) ?? 0,
        location: location?.name || undefined,
      });
    }
  } catch (err) {
    logError("[search-tasks] Error fetching production context", { error: err });
  }

  return map;
}

async function fetchDispatchContextBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  pickListIds: string[]
): Promise<Map<string, DispatchContext>> {
  const map = new Map<string, DispatchContext>();
  if (pickListIds.length === 0) return map;

  try {
    const { data: pickLists } = await supabase
      .from("pick_lists")
      .select(
        `
        id, items_total, items_picked,
        orders!pick_lists_order_id_fkey(
          order_number,
          customers!orders_customer_id_fkey(company_name)
        )
      `
      )
      .eq("org_id", orgId)
      .in("id", pickListIds);

    for (const pl of pickLists ?? []) {
      const order = pl.orders as unknown as {
        order_number: string;
        customers: { company_name: string } | null;
      } | null;

      map.set(pl.id, {
        type: "dispatch",
        orderNumber: order?.order_number || undefined,
        customerName: order?.customers?.company_name || undefined,
        itemsTotal: pl.items_total ?? 0,
        itemsPicked: pl.items_picked ?? 0,
      });
    }
  } catch (err) {
    logError("[search-tasks] Error fetching dispatch context", { error: err });
  }

  return map;
}

async function fetchPlantHealthContextBatch(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  ipmTaskIds: string[]
): Promise<Map<string, PlantHealthContext>> {
  const map = new Map<string, PlantHealthContext>();
  if (ipmTaskIds.length === 0) return map;

  try {
    const { data: ipmTasks } = await supabase
      .from("ipm_tasks")
      .select(`id, method, products!ipm_tasks_product_id_fkey(name)`)
      .eq("org_id", orgId)
      .in("id", ipmTaskIds);

    const { data: batchCounts } = await supabase
      .from("ipm_task_batches")
      .select("ipm_task_id")
      .in("ipm_task_id", ipmTaskIds);

    const countMap = new Map<string, number>();
    for (const link of batchCounts ?? []) {
      countMap.set(link.ipm_task_id, (countMap.get(link.ipm_task_id) ?? 0) + 1);
    }

    for (const ipmTask of ipmTasks ?? []) {
      const product = ipmTask.products as unknown as { name: string } | null;
      map.set(ipmTask.id, {
        type: "plant_health",
        productName: product?.name || undefined,
        methodName: ipmTask.method || undefined,
        batchCount: countMap.get(ipmTask.id) ?? 0,
      });
    }
  } catch (err) {
    logError("[search-tasks] Error fetching plant health context", {
      error: err,
    });
  }

  return map;
}
