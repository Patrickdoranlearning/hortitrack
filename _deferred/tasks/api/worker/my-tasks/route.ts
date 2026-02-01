import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";
import type {
  Task,
  TaskStatus,
} from "@/server/tasks/service";
import type {
  WorkerTask,
  WorkerTasksResponse,
  TaskStats,
  ProductionContext,
  DispatchContext,
  PlantHealthContext,
} from "@/lib/types/worker-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  date: z.string().optional(),
});

/**
 * GET /api/worker/my-tasks
 * Fetches tasks assigned to the current user for the given date (default: today)
 * Enriches tasks with module-specific context
 */
export async function GET(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Parse query params
    const url = new URL(req.url);
    const query = QuerySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
    });

    // Default to today
    const targetDate = query.date || new Date().toISOString().split("T")[0];

    // Fetch tasks assigned to this user
    // Include: assigned, in_progress (active work)
    // For display we also want pending if they're team-visible
    const { data: taskRows, error: taskError } = await supabase
      .from("tasks_with_productivity")
      .select("*")
      .eq("org_id", orgId)
      .eq("assigned_to", user.id)
      .in("status", ["pending", "assigned", "in_progress"])
      .or(`scheduled_date.is.null,scheduled_date.eq.${targetDate}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (taskError) {
      logError("[api/worker/my-tasks] Error fetching tasks", { error: taskError });
      return NextResponse.json(
        { error: taskError.message },
        { status: 500 }
      );
    }

    const tasks = taskRows ?? [];

    // Fetch completed tasks count for today (for stats)
    const { count: completedCount } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("assigned_to", user.id)
      .eq("status", "completed")
      .gte("completed_at", `${targetDate}T00:00:00`)
      .lt("completed_at", `${targetDate}T23:59:59.999`);

    // Map tasks to WorkerTask with module context
    const workerTasks: WorkerTask[] = await enrichTasksWithContext(
      tasks.map(mapRowToTask),
      supabase,
      orgId
    );

    // Calculate stats
    const stats: TaskStats = {
      pending: tasks.filter((t) => t.status === "pending" || t.status === "assigned").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completedToday: completedCount ?? 0,
    };

    const response: WorkerTasksResponse = {
      tasks: workerTasks,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    logError("[api/worker/my-tasks] Error", { error });
    const message = error instanceof Error ? error.message : "Failed to fetch tasks";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Map database row to Task type
 */
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
 * Enrich tasks with module-specific context
 */
async function enrichTasksWithContext(
  tasks: Task[],
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string
): Promise<WorkerTask[]> {
  // Group tasks by source module for batch fetching
  const productionTaskIds: string[] = [];
  const dispatchTaskIds: string[] = [];
  const plantHealthTaskIds: string[] = [];

  for (const task of tasks) {
    if (!task.sourceRefId) continue;
    switch (task.sourceModule) {
      case "production":
        productionTaskIds.push(task.sourceRefId);
        break;
      case "dispatch":
        dispatchTaskIds.push(task.sourceRefId);
        break;
      case "plant_health":
        plantHealthTaskIds.push(task.sourceRefId);
        break;
    }
  }

  // Fetch context data in parallel
  const [productionContext, dispatchContext, plantHealthContext] = await Promise.all([
    fetchProductionContext(supabase, orgId, productionTaskIds),
    fetchDispatchContext(supabase, orgId, dispatchTaskIds),
    fetchPlantHealthContext(supabase, orgId, plantHealthTaskIds),
  ]);

  // Map context to tasks
  return tasks.map((task): WorkerTask => {
    let moduleContext: WorkerTask["moduleContext"];

    if (task.sourceRefId) {
      switch (task.sourceModule) {
        case "production":
          moduleContext = productionContext.get(task.sourceRefId);
          break;
        case "dispatch":
          moduleContext = dispatchContext.get(task.sourceRefId);
          break;
        case "plant_health":
          moduleContext = plantHealthContext.get(task.sourceRefId);
          break;
      }
    }

    return {
      ...task,
      moduleContext,
    };
  });
}

/**
 * Fetch production job context
 */
async function fetchProductionContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  jobIds: string[]
): Promise<Map<string, ProductionContext>> {
  const map = new Map<string, ProductionContext>();
  if (jobIds.length === 0) return map;

  try {
    const { data: jobs } = await supabase
      .from("jobs")
      .select(`
        id,
        name,
        process_type,
        location_id,
        locations!jobs_location_id_fkey(name)
      `)
      .eq("org_id", orgId)
      .in("id", jobIds);

    if (jobs) {
      // Get batch counts per job
      const { data: batchCounts } = await supabase
        .from("job_batches")
        .select("job_id")
        .in("job_id", jobIds);

      const countMap = new Map<string, number>();
      for (const jb of batchCounts ?? []) {
        countMap.set(jb.job_id, (countMap.get(jb.job_id) ?? 0) + 1);
      }

      for (const job of jobs) {
        // Supabase returns single object for !fkey joins, but types show array
        const location = (job.locations as unknown) as { name: string } | null;
        map.set(job.id, {
          type: "production",
          jobName: job.name || undefined,
          processType: job.process_type || undefined,
          batchCount: countMap.get(job.id) ?? 0,
          location: location?.name || undefined,
        });
      }
    }
  } catch (err) {
    logError("[api/worker/my-tasks] Error fetching production context", { error: err });
  }

  return map;
}

/**
 * Fetch dispatch/picking context
 */
async function fetchDispatchContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  pickListIds: string[]
): Promise<Map<string, DispatchContext>> {
  const map = new Map<string, DispatchContext>();
  if (pickListIds.length === 0) return map;

  try {
    const { data: pickLists } = await supabase
      .from("pick_lists")
      .select(`
        id,
        order_id,
        items_total,
        items_picked,
        orders!pick_lists_order_id_fkey(
          order_number,
          customers!orders_customer_id_fkey(company_name)
        )
      `)
      .eq("org_id", orgId)
      .in("id", pickListIds);

    if (pickLists) {
      for (const pl of pickLists) {
        // Supabase returns single object for !fkey joins, but types show array
        const order = (pl.orders as unknown) as {
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
    }
  } catch (err) {
    logError("[api/worker/my-tasks] Error fetching dispatch context", { error: err });
  }

  return map;
}

/**
 * Fetch plant health/IPM context
 */
async function fetchPlantHealthContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  ipmTaskIds: string[]
): Promise<Map<string, PlantHealthContext>> {
  const map = new Map<string, PlantHealthContext>();
  if (ipmTaskIds.length === 0) return map;

  try {
    const { data: ipmTasks } = await supabase
      .from("ipm_tasks")
      .select(`
        id,
        method,
        product_id,
        products!ipm_tasks_product_id_fkey(name)
      `)
      .eq("org_id", orgId)
      .in("id", ipmTaskIds);

    if (ipmTasks) {
      // Get batch counts per IPM task
      const { data: batchLinks } = await supabase
        .from("ipm_task_batches")
        .select("ipm_task_id")
        .in("ipm_task_id", ipmTaskIds);

      const countMap = new Map<string, number>();
      for (const link of batchLinks ?? []) {
        countMap.set(link.ipm_task_id, (countMap.get(link.ipm_task_id) ?? 0) + 1);
      }

      for (const ipmTask of ipmTasks) {
        // Supabase returns single object for !fkey joins, but types show array
        const product = (ipmTask.products as unknown) as { name: string } | null;
        map.set(ipmTask.id, {
          type: "plant_health",
          productName: product?.name || undefined,
          methodName: ipmTask.method || undefined,
          batchCount: countMap.get(ipmTask.id) ?? 0,
        });
      }
    }
  } catch (err) {
    logError("[api/worker/my-tasks] Error fetching plant health context", { error: err });
  }

  return map;
}
