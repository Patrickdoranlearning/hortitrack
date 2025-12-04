import "server-only";
import { addMonths, format, isBefore, startOfMonth } from "date-fns";
import { getUserAndOrg } from "@/server/auth/org";
import type { PlanningSnapshot, PlanningBatch, PlanningBucket, ProtocolSummary } from "@/lib/planning/types";
import type { ProductionProtocolRoute } from "@/lib/protocol-types";

type BatchRow = {
  id: string;
  batch_number: string | null;
  status: string | null;
  phase: string | null;
  quantity: number | null;
  reserved_quantity: number | null;
  ready_at: string | null;
  planted_at: string | null;
  parent_batch_id: string | null;
  protocol_id: string | null;
  plant_variety_id: string | null;
  size_id: string | null;
  plant_varieties?: { name: string | null };
  plant_sizes?: { name: string | null };
  nursery_locations?: { name: string | null };
};

export type ProtocolRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  target_variety_id: string | null;
  target_size_id: string | null;
  is_active: boolean | null;
  definition: Record<string, unknown> | null;
  route: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  plant_varieties?: { name: string | null };
  plant_sizes?: { name: string | null };
};

const GHOST_STATUSES = new Set(["Incoming", "Planned"]);

export async function getPlanningSnapshot(horizonMonths = 12): Promise<PlanningSnapshot> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("batches")
    .select(
      [
        "id",
        "batch_number",
        "status",
        "phase",
        "quantity",
        "reserved_quantity",
        "ready_at",
        "planted_at",
        "parent_batch_id",
        "protocol_id",
        "plant_variety_id",
        "size_id",
        "plant_varieties(name)",
        "plant_sizes(name)",
        "nursery_locations(name)",
      ].join(",")
    )
    .eq("org_id", orgId)
    .order("ready_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const batches = (data ?? []).map(mapBatchRow).sort(sortByReadyDate);
  const buckets = buildBuckets(batches, horizonMonths);

  return {
    buckets,
    batches,
    generatedAt: new Date().toISOString(),
  };
}

export async function listProtocols(): Promise<ProtocolSummary[]> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("protocols")
    .select(
      [
        "id",
        "org_id",
        "name",
        "description",
        "target_variety_id",
        "target_size_id",
        "is_active",
        "definition",
        "route",
        "created_at",
        "updated_at",
        "plant_varieties(name)",
        "plant_sizes(name)",
      ].join(",")
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(rowToProtocolSummary);
}

function mapBatchRow(row: BatchRow): PlanningBatch {
  return {
    id: row.id,
    batchNumber: row.batch_number,
    status: row.status ?? "Unknown",
    phase: row.phase,
    quantity: Number(row.quantity ?? 0),
    reservedQuantity: Number(row.reserved_quantity ?? 0),
    readyDate: row.ready_at,
    startDate: row.planted_at,
    varietyName: row.plant_varieties?.name ?? null,
    varietyId: row.plant_variety_id,
    sizeName: row.plant_sizes?.name ?? null,
    sizeId: row.size_id,
    parentBatchId: row.parent_batch_id,
    protocolId: row.protocol_id,
    locationName: row.nursery_locations?.name ?? null,
    isGhost: GHOST_STATUSES.has(row.status ?? ""),
  };
}

function buildBuckets(batches: PlanningBatch[], horizonMonths: number): PlanningBucket[] {
  const start = startOfMonth(new Date());
  const end = addMonths(start, horizonMonths);
  const template: PlanningBucket[] = [];

  for (let i = 0; i < horizonMonths; i++) {
    const monthDate = addMonths(start, i);
    template.push({
      month: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMM yyyy"),
      physical: 0,
      incoming: 0,
      planned: 0,
    });
  }

  for (const batch of batches) {
    const date = parseDate(batch.readyDate ?? batch.startDate);
    if (!date) continue;
    if (isBefore(date, start) || !isBefore(date, end)) continue;

    const bucketKey = format(startOfMonth(date), "yyyy-MM");
    const bucket = template.find((b) => b.month === bucketKey);
    if (!bucket) continue;

    if (batch.status === "Incoming") {
      bucket.incoming += batch.quantity;
    } else if (batch.status === "Planned") {
      bucket.planned += batch.quantity;
    } else {
      bucket.physical += batch.quantity;
    }
  }

  return template;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortByReadyDate(a: PlanningBatch, b: PlanningBatch) {
  const da = a.readyDate ?? a.startDate ?? "";
  const db = b.readyDate ?? b.startDate ?? "";
  return da.localeCompare(db);
}

export function rowToProtocolSummary(row: ProtocolRow): ProtocolSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetVarietyId: row.target_variety_id,
    targetVarietyName: row.plant_varieties?.name ?? null,
    targetSizeId: row.target_size_id,
    targetSizeName: row.plant_sizes?.name ?? null,
    route: (row.route as ProductionProtocolRoute | null) ?? null,
    definition: row.definition ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

