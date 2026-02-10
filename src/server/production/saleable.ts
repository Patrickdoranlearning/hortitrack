import "server-only";

import { getSupabaseAdmin } from "@/server/db/supabase";
import { getStatusCodesByBehavior, listAttributeOptions } from "@/server/attributeOptions/service";
import { logger } from "@/server/utils/logger";

/**
 * Saleable Batches Service
 * 
 * Note: This module uses getSupabaseAdmin() instead of getUserAndOrg() because:
 * 1. These functions are designed to be called from server components or API routes
 *    that have already validated the user's organization access
 * 2. The orgId is passed explicitly to each function, ensuring data isolation
 * 3. This allows the functions to work in contexts where cookies may not be available
 *    (e.g., scheduled jobs, background tasks, or certain server component patterns)
 * 
 * Security: All functions filter by orgId to ensure multi-tenant data isolation.
 * The caller is responsible for ensuring the user has access to the specified org.
 */

export type SaleableBatch = {
  id: string;
  batchNumber: string;
  status: string | null;
  statusId: string | null;
  behavior: string | null; // growing, available, archived
  quantity: number;
  plantVariety: string | null;
  plantVarietyId: string | null;
  size: string | null;
  sizeId: string | null;
  location: string | null;
  locationId: string | null;
  plantedAt: string | null;
  updatedAt: string | null;
  growerPhotoUrl: string | null;
  salesPhotoUrl: string | null;
};

export type ProductionStatusOption = {
  id: string;
  systemCode: string;
  displayLabel: string;
  behavior: string | null;
  color: string | null;
};

export const SALEABLE_STATUSES = ["Ready", "Looking Good"] as const;

type FetchOptions = {
  statuses?: string[];
  showAll?: boolean; // If true, fetch all batches regardless of status
};

/**
 * Fetches batches that are ready or near-ready for sale
 * 
 * @param orgId - Organization ID (caller must verify user has access)
 * @param options - Filtering options
 * @returns Array of saleable batches with joined reference data
 */
export async function fetchSaleableBatches(orgId: string, options: FetchOptions = {}) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("batches")
    .select(
      `
        id,
        batch_number,
        status,
        status_id,
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
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  // Only filter by status if not showing all and specific statuses requested
  if (!options.showAll) {
    let statuses: string[] = [];
    if (options.statuses && options.statuses.length > 0) {
      statuses = options.statuses;
    } else {
      try {
        statuses = await getStatusCodesByBehavior(orgId, "available", supabase);
      } catch (err) {
        logger.production.warn("Status lookup failed for saleable batches, falling back to defaults", { orgId, error: err instanceof Error ? err.message : String(err) });
      }
      if (!statuses.length) {
        statuses = [...SALEABLE_STATUSES];
      }
    }

    // Include legacy "Ready for Sale" records whenever "Ready" is selected
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

    if (queryStatuses.length > 0) {
      query = query.in("status", queryStatuses);
    }
  }

  const { data, error } = await query;

  if (error) {
    logger.production.error("Failed to fetch saleable batches", error, { orgId });
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
      ? supabase.from("plant_sizes").select("id, name").in("id", sizeIds)
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
    logger.production.warn("Plant varieties lookup failed for saleable batches", { error: varietiesRes.error.message });
  }
  if (sizesRes.error) {
    logger.production.warn("Plant sizes lookup failed for saleable batches", { error: sizesRes.error.message });
  }
  if (locationsRes.error) {
    logger.production.warn("Nursery locations lookup failed for saleable batches", { error: locationsRes.error.message });
  }

  const varietyMap = new Map(
    (varietiesRes.data ?? []).map((row) => [row.id, row.name ?? null])
  );
  const sizeMap = new Map((sizesRes.data ?? []).map((row) => [row.id, row.name ?? null]));
  const locationMap = new Map(
    (locationsRes.data ?? []).map((row) => [row.id, row.name ?? null])
  );

  // Build a map of status_id to behavior
  const statusBehaviorMap = new Map<string, string>();
  const { options: statusOptions } = await listAttributeOptions({
    orgId,
    attributeKey: "production_status",
    includeInactive: false,
    supabase,
  });
  for (const opt of statusOptions) {
    if (opt.id && opt.behavior) {
      statusBehaviorMap.set(opt.id, opt.behavior);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    batchNumber: row.batch_number ?? "",
    status: row.status ?? null,
    statusId: row.status_id ?? null,
    behavior: row.status_id ? (statusBehaviorMap.get(row.status_id) ?? null) : null,
    quantity: row.quantity ?? 0,
    plantVariety: varietyMap.get(row.plant_variety_id ?? "") ?? null,
    plantVarietyId: row.plant_variety_id ?? null,
    size: sizeMap.get(row.size_id ?? "") ?? null,
    sizeId: row.size_id ?? null,
    location: locationMap.get(row.location_id ?? "") ?? null,
    locationId: row.location_id ?? null,
    plantedAt: row.planted_at ?? null,
    updatedAt: row.updated_at ?? null,
    growerPhotoUrl: row.grower_photo_url ?? null,
    salesPhotoUrl: row.sales_photo_url ?? null,
  })) satisfies SaleableBatch[];
}

/**
 * Fetches all nursery locations for filter dropdowns
 * 
 * @param orgId - Organization ID (caller must verify user has access)
 * @returns Array of locations with id and name
 */
export async function fetchLocations(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("nursery_locations")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");
  
  if (error) {
    logger.production.error("Failed to fetch locations", error, { orgId });
    return [];
  }
  return data ?? [];
}

/**
 * Fetches all plant varieties for filter dropdowns
 * 
 * @param orgId - Organization ID (caller must verify user has access)
 * @returns Array of varieties with id and name
 */
export async function fetchVarieties(orgId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("plant_varieties")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");
  
  if (error) {
    logger.production.error("Failed to fetch varieties", error, { orgId });
    return [];
  }
  return data ?? [];
}

/**
 * Fetches production status options with their behaviors for filtering
 * 
 * @param orgId - Organization ID (caller must verify user has access)
 * @returns Array of status options with behavior and color information
 */
export async function fetchProductionStatusOptions(orgId: string): Promise<ProductionStatusOption[]> {
  const { options } = await listAttributeOptions({
    orgId,
    attributeKey: "production_status",
    includeInactive: false,
  });
  
  return options.map(opt => ({
    id: opt.id ?? "",
    systemCode: opt.systemCode,
    displayLabel: opt.displayLabel,
    behavior: opt.behavior ?? null,
    color: opt.color ?? null,
  }));
}
