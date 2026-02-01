import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getTaskById } from "@/server/tasks/service";
import { getJobById, getJobBatches } from "@/server/production/jobs";
import { getTemplatesForProcess } from "@/server/tasks/checklist-service";
import { logError } from "@/lib/log";
import type { WorkerTask, ProductionContext, DispatchContext, PlantHealthContext } from "@/lib/types/worker-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/worker/task/[id]
 * Fetches a single task with full module context for the worker app
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { supabase, orgId, user } = await getUserAndOrg();

    // Fetch the task
    const task = await getTaskById(id);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify user has access to this task
    if (task.assignedTo && task.assignedTo !== user.id) {
      // Allow if user is admin/owner - otherwise restrict
      const { data: membership } = await supabase
        .from("org_memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .single();

      const isAdmin = membership?.role === "admin" || membership?.role === "owner";
      if (!isAdmin) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Build enriched response based on source module
    const workerTask: WorkerTask = { ...task };
    let moduleData: Record<string, unknown> = {};

    if (task.sourceModule === "production" && task.sourceRefId) {
      const { jobData, jobBatches, checklistTemplates } = await fetchProductionContext(
        task.sourceRefId
      );
      moduleData = { job: jobData, batches: jobBatches, checklistTemplates };

      if (jobData) {
        workerTask.moduleContext = {
          type: "production",
          jobName: jobData.name || undefined,
          processType: jobData.processType || undefined,
          batchCount: jobData.batchCount,
          location: jobData.location || undefined,
        } as ProductionContext;
      }
    } else if (task.sourceModule === "dispatch" && task.sourceRefId) {
      const pickListData = await fetchDispatchContext(supabase, orgId, task.sourceRefId);
      moduleData = { pickList: pickListData };

      if (pickListData) {
        workerTask.moduleContext = {
          type: "dispatch",
          orderNumber: pickListData.orderNumber || undefined,
          customerName: pickListData.customerName || undefined,
          itemsTotal: pickListData.itemsTotal,
          itemsPicked: pickListData.itemsPicked,
        } as DispatchContext;
      }
    } else if (task.sourceModule === "plant_health" && task.sourceRefId) {
      const ipmData = await fetchPlantHealthContext(supabase, orgId, task.sourceRefId);
      moduleData = { ipmTask: ipmData };

      if (ipmData) {
        workerTask.moduleContext = {
          type: "plant_health",
          productName: ipmData.productName || undefined,
          methodName: ipmData.method || undefined,
          batchCount: ipmData.batchCount,
        } as PlantHealthContext;
      }
    }

    return NextResponse.json({
      task: workerTask,
      ...moduleData,
    });
  } catch (error) {
    logError("[api/worker/task/[id]] GET error", { error });
    const message = error instanceof Error ? error.message : "Failed to fetch task";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Fetch production job context with batches and checklists
 * Note: supabase and orgId not needed - getJobById/getJobBatches use their own connections
 */
async function fetchProductionContext(jobId: string) {
  try {
    const jobData = await getJobById(jobId);
    const jobBatches = jobData ? await getJobBatches(jobId) : [];

    // Get checklist templates for this process type
    let checklistTemplates = { prerequisites: [] as unknown[], postrequisites: [] as unknown[] };
    if (jobData?.processType) {
      checklistTemplates = await getTemplatesForProcess("production", jobData.processType);
    }

    return { jobData, jobBatches, checklistTemplates };
  } catch (err) {
    logError("[api/worker/task] Error fetching production context", { error: err, jobId });
    return { jobData: null, jobBatches: [], checklistTemplates: { prerequisites: [], postrequisites: [] } };
  }
}

/**
 * Fetch dispatch/pick list context
 */
async function fetchDispatchContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  pickListId: string
) {
  try {
    const { data: pickList, error } = await supabase
      .from("pick_lists")
      .select(`
        id,
        items_total,
        items_picked,
        status,
        orders!pick_lists_order_id_fkey(
          order_number,
          delivery_date,
          customers!orders_customer_id_fkey(company_name)
        )
      `)
      .eq("id", pickListId)
      .eq("org_id", orgId)
      .single();

    if (error || !pickList) return null;

    // Fetch pick list items
    const { data: items } = await supabase
      .from("pick_list_items")
      .select(`
        id,
        quantity,
        quantity_picked,
        batches!pick_list_items_batch_id_fkey(
          plant_varieties(name),
          plant_sizes(name)
        )
      `)
      .eq("pick_list_id", pickListId);

    const order = (pickList.orders as unknown) as {
      order_number: string;
      delivery_date: string | null;
      customers: { company_name: string } | null;
    } | null;

    return {
      id: pickList.id,
      orderNumber: order?.order_number || null,
      customerName: order?.customers?.company_name || null,
      deliveryDate: order?.delivery_date || null,
      itemsTotal: pickList.items_total ?? 0,
      itemsPicked: pickList.items_picked ?? 0,
      status: pickList.status,
      items: (items ?? []).map((item) => {
        const batch = (item.batches as unknown) as {
          plant_varieties?: { name: string } | null;
          plant_sizes?: { name: string } | null;
        } | null;
        return {
          id: item.id,
          varietyName: batch?.plant_varieties?.name || null,
          sizeName: batch?.plant_sizes?.name || null,
          quantity: item.quantity ?? 0,
          quantityPicked: item.quantity_picked ?? 0,
        };
      }),
    };
  } catch (err) {
    logError("[api/worker/task] Error fetching dispatch context", { error: err, pickListId });
    return null;
  }
}

/**
 * Fetch plant health/IPM task context
 */
async function fetchPlantHealthContext(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  ipmTaskId: string
) {
  try {
    const { data: ipmTask, error } = await supabase
      .from("ipm_tasks")
      .select(`
        id,
        method,
        rate,
        rate_unit,
        notes,
        products!ipm_tasks_product_id_fkey(name)
      `)
      .eq("id", ipmTaskId)
      .eq("org_id", orgId)
      .single();

    if (error || !ipmTask) return null;

    // Fetch associated batches
    const { data: batchLinks } = await supabase
      .from("ipm_task_batches")
      .select(`
        batch_id,
        batches!ipm_task_batches_batch_id_fkey(
          id,
          batch_number,
          quantity,
          plant_varieties(name)
        )
      `)
      .eq("ipm_task_id", ipmTaskId);

    const product = (ipmTask.products as unknown) as { name: string } | null;

    const batches = (batchLinks ?? []).map((link) => {
      const batch = (link.batches as unknown) as {
        id: string;
        batch_number: string | null;
        quantity: number | null;
        plant_varieties?: { name: string } | null;
      } | null;
      return {
        batchId: batch?.id ?? link.batch_id,
        batchNumber: batch?.batch_number || null,
        varietyName: batch?.plant_varieties?.name || null,
        quantity: batch?.quantity ?? 0,
      };
    });

    return {
      id: ipmTask.id,
      method: ipmTask.method,
      productName: product?.name || null,
      productRate: ipmTask.rate?.toString() || null,
      productUnit: ipmTask.rate_unit || null,
      notes: ipmTask.notes,
      batchCount: batches.length,
      batches,
    };
  } catch (err) {
    logError("[api/worker/task] Error fetching plant health context", { error: err, ipmTaskId });
    return null;
  }
}
