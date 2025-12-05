import "server-only";

import { getSupabaseAdmin } from "@/server/db/supabase";
import { getStatusCodesByBehavior } from "@/server/attributeOptions/service";

export type SaleableBatch = {
  id: string;
  batchNumber: string;
  status: string | null;
  quantity: number;
  plantVariety: string | null;
  size: string | null;
  location: string | null;
  plantedAt: string | null;
  updatedAt: string | null;
  growerPhotoUrl: string | null;
  salesPhotoUrl: string | null;
};

export const SALEABLE_STATUSES = ["Ready", "Looking Good"] as const;

type FetchOptions = {
  statuses?: string[];
};

export async function fetchSaleableBatches(orgId: string, options: FetchOptions = {}) {
  const supabase = getSupabaseAdmin();

  let statuses: string[] = [];
  if (options.statuses && options.statuses.length > 0) {
    statuses = options.statuses;
  } else {
    try {
      statuses = await getStatusCodesByBehavior(orgId, "available", supabase);
    } catch (err) {
      console.warn("[fetchSaleableBatches] status lookup failed, falling back to defaults", err);
    }
    if (!statuses.length) {
      statuses = [...SALEABLE_STATUSES];
    }
  }

  // Include legacy "Ready for Sale" records whenever "Ready" is selected so older data still appears.
  const queryStatuses = Array.from(
    new Set(
      statuses.flatMap((status) => {
        if (status === "Ready" || status === "Ready for Sale") {
          return ["Ready", "Ready for Sale"];
        }
        return [status];
      })
    )
  );

  let query = supabase
    .from("batches")
    .select(
      `
        id,
        batch_number,
        status,
        quantity,
        planted_at,
        updated_at,
        grower_photo_url,
        sales_photo_url,
        plant_variety_id,
        size_id,
        location_id
      `
    )
    .eq("org_id", orgId)
    .gt("quantity", 0)
    .order("updated_at", { ascending: false });

  if (queryStatuses.length > 0) {
    query = query.in("status", queryStatuses);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[fetchSaleableBatches]", error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const varietyIds = Array.from(
    new Set(rows.map((row) => row.plant_variety_id).filter(Boolean))
  ) as string[];
  const sizeIds = Array.from(new Set(rows.map((row) => row.size_id).filter(Boolean))) as string[];
  const locationIds = Array.from(
    new Set(rows.map((row) => row.location_id).filter(Boolean))
  ) as string[];

  const [varietiesRes, sizesRes, locationsRes] = await Promise.all([
    varietyIds.length
      ? supabase.from("plant_varieties").select("id, name").eq("org_id", orgId).in("id", varietyIds)
      : { data: [], error: null },
    sizeIds.length
      ? supabase.from("plant_sizes").select("id, name").eq("org_id", orgId).in("id", sizeIds)
      : { data: [], error: null },
    locationIds.length
      ? supabase
          .from("nursery_locations")
          .select("id, name")
          .eq("org_id", orgId)
          .in("id", locationIds)
      : { data: [], error: null },
  ]);

  if (varietiesRes.error) {
    console.warn("[fetchSaleableBatches] plant varieties lookup failed", varietiesRes.error);
  }
  if (sizesRes.error) {
    console.warn("[fetchSaleableBatches] plant sizes lookup failed", sizesRes.error);
  }
  if (locationsRes.error) {
    console.warn("[fetchSaleableBatches] nursery locations lookup failed", locationsRes.error);
  }

  const varietyMap = new Map(
    (varietiesRes.data ?? []).map((row) => [row.id, row.name ?? null])
  );
  const sizeMap = new Map((sizesRes.data ?? []).map((row) => [row.id, row.name ?? null]));
  const locationMap = new Map(
    (locationsRes.data ?? []).map((row) => [row.id, row.name ?? null])
  );

  return rows.map((row) => ({
    id: row.id,
    batchNumber: row.batch_number ?? "",
    // Normalize legacy status labels to keep filters working
    status: row.status === "Ready for Sale" ? "Ready" : row.status ?? null,
    quantity: row.quantity ?? 0,
    plantVariety: varietyMap.get(row.plant_variety_id ?? "") ?? null,
    size: sizeMap.get(row.size_id ?? "") ?? null,
    location: locationMap.get(row.location_id ?? "") ?? null,
    plantedAt: row.planted_at ?? null,
    updatedAt: row.updated_at ?? null,
    growerPhotoUrl: row.grower_photo_url ?? null,
    salesPhotoUrl: row.sales_photo_url ?? null,
  })) satisfies SaleableBatch[];
}
