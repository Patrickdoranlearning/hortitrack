import "server-only";
import { getUserAndOrg } from "@/server/auth/org";
import { computeRouteSchedule } from "@/lib/planning/schedule";
import type { ProductionProtocolRoute } from "@/lib/protocol-types";

export type ProductionTaskStage = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  stageName?: string | null;
  locationName?: string | null;
};

export type ProductionTask = {
  id: string;
  batchId: string;
  batchNumber: string;
  varietyName: string;
  varietyId: string | null;
  sizeName: string;
  sizeId: string | null;
  quantity: number;
  status: "Planned" | "Incoming";
  dueDate: string; // Start of production (first stage)
  readyDate: string; // Target ready date
  locationName: string | null;
  protocol: { id: string; name: string } | null;
  stages: ProductionTaskStage[];
  parentBatchId: string | null;
  parentBatchNumber: string | null;
};

type BatchRow = {
  id: string;
  batch_number: string | null;
  status: string | null;
  phase: string | null;
  quantity: number | null;
  ready_at: string | null;
  planted_at: string | null;
  parent_batch_id: string | null;
  protocol_id: string | null;
  plant_variety_id: string | null;
  size_id: string | null;
  plant_varieties: { name: string | null } | null;
  plant_sizes: { name: string | null } | null;
  nursery_locations: { name: string | null } | null;
  protocols: { id: string; name: string; route: ProductionProtocolRoute | null } | null;
  parent_batch: { batch_number: string | null } | null;
};

export type TasksFilter = {
  startDate?: string;
  endDate?: string;
  status?: "Planned" | "Incoming" | "all";
  varietyId?: string;
};

/**
 * Fetches production tasks (ghost batches) with their computed schedules
 */
export async function getProductionTasks(filter: TasksFilter = {}): Promise<ProductionTask[]> {
  const { supabase, orgId } = await getUserAndOrg();

  let query = supabase
    .from("batches")
    .select(
      [
        "id",
        "batch_number",
        "status",
        "phase",
        "quantity",
        "ready_at",
        "planted_at",
        "parent_batch_id",
        "protocol_id",
        "plant_variety_id",
        "size_id",
        "plant_varieties(name)",
        "plant_sizes(name)",
        "nursery_locations(name)",
        "protocols(id, name, route)",
        "parent_batch:batches!parent_batch_id(batch_number)",
      ].join(",")
    )
    .eq("org_id", orgId)
    .in("status", ["Incoming", "Planned"])
    .order("ready_at", { ascending: true });

  // Apply date filters
  if (filter.startDate) {
    query = query.gte("ready_at", filter.startDate);
  }
  if (filter.endDate) {
    query = query.lte("ready_at", filter.endDate);
  }

  // Apply status filter
  if (filter.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  // Apply variety filter
  if (filter.varietyId) {
    query = query.eq("plant_variety_id", filter.varietyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[tasks] Error fetching production tasks:", error);
    throw new Error(error.message);
  }

  // Cast to proper type (Supabase generic types can be imprecise)
  const batches = (data ?? []) as unknown as BatchRow[];
  return batches.map(mapBatchToTask);
}

function mapBatchToTask(row: BatchRow): ProductionTask {
  const readyDate = row.ready_at ?? new Date().toISOString().slice(0, 10);
  const protocolRoute = row.protocols?.route ?? null;
  
  // Compute schedule from protocol route
  const schedule = computeRouteSchedule(protocolRoute, readyDate);
  
  // Due date is the start of the first stage (or planted_at if no protocol)
  const dueDate = schedule.nodes.length > 0 
    ? schedule.nodes[0].startDate 
    : row.planted_at ?? readyDate;

  return {
    id: row.id,
    batchId: row.id,
    batchNumber: row.batch_number ?? `B-${row.id.slice(0, 8)}`,
    varietyName: row.plant_varieties?.name ?? "Unknown variety",
    varietyId: row.plant_variety_id,
    sizeName: row.plant_sizes?.name ?? "Unknown size",
    sizeId: row.size_id,
    quantity: row.quantity ?? 0,
    status: (row.status === "Incoming" ? "Incoming" : "Planned") as "Planned" | "Incoming",
    dueDate: typeof dueDate === "string" ? dueDate.slice(0, 10) : dueDate,
    readyDate: readyDate.slice(0, 10),
    locationName: row.nursery_locations?.name ?? null,
    protocol: row.protocols ? { id: row.protocols.id, name: row.protocols.name } : null,
    stages: schedule.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      startDate: node.startDate.slice(0, 10),
      endDate: node.endDate.slice(0, 10),
      durationDays: node.durationDays,
      stageName: node.stageName,
      locationName: node.locationName,
    })),
    parentBatchId: row.parent_batch_id,
    parentBatchNumber: row.parent_batch?.batch_number ?? null,
  };
}

/**
 * Groups tasks by week for calendar view
 */
export function groupTasksByWeek(tasks: ProductionTask[]): Map<string, ProductionTask[]> {
  const weekMap = new Map<string, ProductionTask[]>();
  
  for (const task of tasks) {
    const weekKey = getWeekKey(task.dueDate);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(task);
  }
  
  return weekMap;
}

/**
 * Returns the ISO week key (YYYY-Www) for a date
 */
function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const weekNumber = getISOWeekNumber(date);
  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Gets the ISO week number for a date
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

