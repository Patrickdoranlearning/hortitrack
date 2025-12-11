import "server-only";
import { addMonths, format, startOfMonth } from "date-fns";
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

  // Use SQL aggregation for buckets (much faster than JS aggregation)
  // and fetch batch details in parallel
  const startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [bucketsResult, batchesResult] = await Promise.all([
    // Aggregated buckets from SQL RPC
    supabase.rpc("get_planning_buckets", {
      p_org_id: orgId,
      p_start_date: startDate,
      p_horizon_months: horizonMonths,
    }),
    // Batch details for the planning view (still needed for detail displays)
    supabase
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
      .order("ready_at", { ascending: true }),
  ]);

  if (batchesResult.error) {
    throw new Error(batchesResult.error.message);
  }

  // Prefer SQL RPC buckets, but fall back to JS aggregation when the function
  // is missing (e.g. migration not applied yet).
  const buckets: PlanningBucket[] =
    bucketsResult.error && batchesResult.data
      ? buildBucketsFromBatches(batchesResult.data, startDate, horizonMonths)
      : (bucketsResult.data ?? []).map((row: any) => ({
          month: row.bucket_month,
          label: row.bucket_label,
          physical: Number(row.physical),
          incoming: Number(row.incoming),
          planned: Number(row.planned),
        }));

  if (bucketsResult.error && batchesResult.data) {
    console.warn(
      "[planning] get_planning_buckets RPC unavailable; using JS fallback:",
      bucketsResult.error.message
    );
  }

  if (bucketsResult.error && !batchesResult.data) {
    // If both the RPC failed and we have no batch data, surface the RPC error.
    throw new Error(bucketsResult.error.message);
  }

  const batches = (batchesResult.data ?? []).map(mapBatchRow).sort(sortByReadyDate);

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

// buildBuckets is now handled by SQL RPC get_planning_buckets for performance

function buildBucketsFromBatches(rows: BatchRow[], startDate: string, horizonMonths: number): PlanningBucket[] {
  const start = startOfMonth(new Date(startDate));
  const horizonEnd = addMonths(start, horizonMonths);

  const buckets: PlanningBucket[] = Array.from({ length: horizonMonths }, (_, i) => {
    const monthDate = addMonths(start, i);
    return {
      month: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMM yyyy"),
      physical: 0,
      incoming: 0,
      planned: 0,
    };
  });

  const bucketMap = new Map(buckets.map((b) => [b.month, b]));

  for (const row of rows) {
    const date = parseDate(row.ready_at) ?? parseDate(row.planted_at);
    if (!date) continue;
    if (date < start || date >= horizonEnd) continue;

    const monthKey = format(startOfMonth(date), "yyyy-MM");
    const bucket = bucketMap.get(monthKey);
    if (!bucket) continue;

    const qty = Number(row.quantity ?? 0);
    if (!Number.isFinite(qty)) continue;

    const status = row.status ?? "";
    if (status === "Incoming") {
      bucket.incoming += qty;
    } else if (status === "Planned") {
      bucket.planned += qty;
    } else {
      bucket.physical += qty;
    }
  }

  return buckets;
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

