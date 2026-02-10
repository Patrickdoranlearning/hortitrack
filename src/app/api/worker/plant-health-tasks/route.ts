import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";
import type { WorkerTask, TaskStats } from "@/lib/types/worker-tasks";

/**
 * Worker Plant Health Tasks API
 *
 * Returns IPM tasks formatted as WorkerTask for the offline provider.
 * This replaces the generic /api/worker/my-tasks endpoint for plant health tasks.
 */

export async function GET(req: NextRequest) {
  try {
    const { supabase, orgId, user } = await getUserAndOrg();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // Get today's date for filtering
    const today = dateParam || new Date().toISOString().split("T")[0];

    // Get IPM tasks that are pending/overdue (actionable tasks)
    const { data: ipmTasks, error } = await supabase
      .from("ipm_tasks")
      .select(`
        id,
        batch_id,
        location_id,
        product_id,
        product_name,
        rate,
        rate_unit,
        method,
        scheduled_date,
        status,
        notes,
        created_at,
        updated_at,
        batches (
          id,
          batch_number,
          plant_varieties (name)
        ),
        nursery_locations (id, name)
      `)
      .eq("org_id", orgId)
      .in("status", ["pending", "overdue"])
      .order("scheduled_date", { ascending: true })
      .limit(50);

    if (error) {
      logger.worker.error("Plant health tasks query failed", error);
      return NextResponse.json(
        { error: "Failed to load tasks" },
        { status: 500 }
      );
    }

    // Transform IPM tasks to WorkerTask format
    const tasks: WorkerTask[] = (ipmTasks || []).map((task) => {
      const batch = task.batches as { id: string; batch_number: string; plant_varieties?: { name: string } } | null;
      const location = task.nursery_locations as { id: string; name: string } | null;
      const isOverdue = task.status === "overdue" ||
        (task.status === "pending" && task.scheduled_date < today);

      return {
        id: task.id,
        orgId,
        sourceModule: "plant_health" as const,
        sourceRefType: "ipm_task",
        sourceRefId: task.id,
        title: `Apply ${task.product_name}`,
        description: batch
          ? `${task.product_name} for batch ${batch.batch_number}${location ? ` in ${location.name}` : ""}`
          : location
            ? `${task.product_name} in ${location.name}`
            : task.product_name,
        taskType: "ipm_treatment",
        status: isOverdue ? "pending" : (task.status === "pending" ? "pending" : "assigned"),
        priority: isOverdue ? "high" : "normal",
        scheduledDate: task.scheduled_date,
        estimatedMinutes: 15,
        plantQuantity: 1,
        batchId: task.batch_id || undefined,
        locationId: task.location_id || undefined,
        notes: task.notes || undefined,
        createdAt: task.created_at,
        updatedAt: task.updated_at || task.created_at,
        moduleContext: {
          type: "plant_health" as const,
          productName: task.product_name,
          methodName: task.method || undefined,
          batchCount: 1,
        },
      };
    });

    // Calculate stats
    const stats: TaskStats = {
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completedToday: 0, // Would need a separate query for this
    };

    return NextResponse.json({ tasks, stats });
  } catch (error) {
    logger.worker.error("Plant health tasks fetch failed", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    if (/Unauthenticated/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to load tasks" },
      { status: 500 }
    );
  }
}
