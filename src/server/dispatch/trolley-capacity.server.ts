import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUserAndOrg } from "@/server/auth/org";
import type { TrolleyCapacityConfig } from "@/lib/dispatch/trolley-calculation";
import { logger } from "@/server/utils/logger";

// ================================================
// TYPES
// ================================================

/** Query result type for trolley capacity with plant size join */
type TrolleyCapacityQueryRow = {
  id: string;
  org_id: string;
  family: string | null;
  size_id: string | null;
  shelves_per_trolley: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plant_sizes: { name: string } | { name: string }[] | null;
};

/** Lightweight query result for calculation */
type TrolleyCapacityCalcRow = {
  family: string | null;
  size_id: string | null;
  shelves_per_trolley: number;
};

/** Helper to get first element from array or value itself */
function asSingle<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export type TrolleyCapacityRecord = {
  id: string;
  orgId: string;
  family: string | null;
  sizeId: string | null;
  sizeName?: string | null;
  shelvesPerTrolley: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTrolleyCapacityInput = {
  id?: string;
  family?: string | null;
  sizeId?: string | null;
  shelvesPerTrolley: number;
  notes?: string | null;
};

// ================================================
// QUERIES
// ================================================

/**
 * Get all trolley capacity configurations for the current org.
 * Returns configs with size name joined for display.
 */
export async function getTrolleyCapacityRecords(): Promise<TrolleyCapacityRecord[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("trolley_capacity")
    .select(`
      id,
      org_id,
      family,
      size_id,
      shelves_per_trolley,
      notes,
      created_at,
      updated_at,
      plant_sizes!trolley_capacity_size_id_fkey (
        name
      )
    `)
    .eq("org_id", orgId)
    .order("family", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    logger.trolley.error("Error fetching trolley capacity records", error, { orgId });
    return [];
  }

  return (data || []).map((row) => {
    const typedRow = row as unknown as TrolleyCapacityQueryRow;
    const plantSize = asSingle(typedRow.plant_sizes);
    return {
      id: typedRow.id,
      orgId: typedRow.org_id,
      family: typedRow.family,
      sizeId: typedRow.size_id,
      sizeName: plantSize?.name ?? null,
      shelvesPerTrolley: typedRow.shelves_per_trolley,
      notes: typedRow.notes,
      createdAt: typedRow.created_at,
      updatedAt: typedRow.updated_at,
    };
  });
}

/**
 * Get trolley capacity configs in the format needed for calculations.
 * This is a lightweight version without UI display fields.
 */
export async function getTrolleyCapacityConfigs(): Promise<TrolleyCapacityConfig[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("trolley_capacity")
    .select("family, size_id, shelves_per_trolley")
    .eq("org_id", orgId);

  if (error) {
    logger.trolley.error("Error fetching trolley capacity configs for calculation", error, { orgId });
    return [];
  }

  return (data || []).map((row: TrolleyCapacityCalcRow) => ({
    family: row.family,
    sizeId: row.size_id,
    shelvesPerTrolley: row.shelves_per_trolley,
  }));
}

/**
 * Get a single trolley capacity record by ID.
 */
export async function getTrolleyCapacityById(
  id: string
): Promise<TrolleyCapacityRecord | null> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("trolley_capacity")
    .select(`
      id,
      org_id,
      family,
      size_id,
      shelves_per_trolley,
      notes,
      created_at,
      updated_at,
      plant_sizes!trolley_capacity_size_id_fkey (
        name
      )
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !data) {
    return null;
  }

  const capacityData = data as unknown as TrolleyCapacityQueryRow;
  const plantSize = asSingle(capacityData.plant_sizes);
  return {
    id: capacityData.id,
    orgId: capacityData.org_id,
    family: capacityData.family,
    sizeId: capacityData.size_id,
    sizeName: plantSize?.name ?? null,
    shelvesPerTrolley: capacityData.shelves_per_trolley,
    notes: capacityData.notes,
    createdAt: capacityData.created_at,
    updatedAt: capacityData.updated_at,
  };
}

// ================================================
// MUTATIONS
// ================================================

/**
 * Create or update a trolley capacity configuration.
 * Uses upsert with the unique constraint on (org_id, family, size_id).
 */
export async function upsertTrolleyCapacity(
  input: UpsertTrolleyCapacityInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { orgId, supabase } = await getUserAndOrg();

  const payload = {
    org_id: orgId,
    family: input.family || null,
    size_id: input.sizeId || null,
    shelves_per_trolley: input.shelvesPerTrolley,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };

  // If we have an ID, update by ID
  if (input.id) {
    const { data, error } = await supabase
      .from("trolley_capacity")
      .update(payload)
      .eq("id", input.id)
      .eq("org_id", orgId)
      .select("id")
      .single();

    if (error) {
      logger.trolley.error("Error updating trolley capacity", error, { orgId, id: input.id });
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  }

  // Otherwise, upsert by unique constraint
  const { data, error } = await supabase
    .from("trolley_capacity")
    .upsert(payload, {
      onConflict: "org_id,family,size_id",
    })
    .select("id")
    .single();

  if (error) {
    logger.trolley.error("Error upserting trolley capacity", error, { orgId, input });
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

/**
 * Delete a trolley capacity configuration by ID.
 */
export async function deleteTrolleyCapacity(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { orgId, supabase } = await getUserAndOrg();

  const { error } = await supabase
    .from("trolley_capacity")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    logger.trolley.error("Error deleting trolley capacity", error, { orgId, id });
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ================================================
// HELPER QUERIES
// ================================================

/**
 * Get distinct plant families from plant_varieties table.
 * Used for the admin UI dropdown.
 */
export async function getDistinctFamilies(): Promise<string[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("plant_varieties")
    .select("family")
    .eq("org_id", orgId)
    .not("family", "is", null)
    .order("family", { ascending: true });

  if (error) {
    logger.trolley.error("Error fetching distinct families", error, { orgId });
    return [];
  }

  // Get unique values
  const families = new Set<string>();
  for (const row of data || []) {
    if (row.family) {
      families.add(row.family);
    }
  }

  return Array.from(families).sort();
}

/**
 * Get all plant sizes with shelf_quantity.
 * Used for the admin UI dropdown and calculation.
 */
export async function getPlantSizesWithShelfQuantity(): Promise<
  Array<{
    id: string;
    name: string;
    shelfQuantity: number | null;
    containerType: string;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plant_sizes")
    .select("id, name, shelf_quantity, container_type")
    .order("name", { ascending: true });

  if (error) {
    logger.trolley.error("Error fetching plant sizes", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    shelfQuantity: row.shelf_quantity,
    containerType: row.container_type,
  }));
}

/**
 * Get shelf quantities for a list of size IDs.
 * Used during order calculation.
 */
export async function getShelfQuantitiesForSizes(
  sizeIds: string[]
): Promise<Map<string, number>> {
  if (sizeIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plant_sizes")
    .select("id, shelf_quantity")
    .in("id", sizeIds);

  if (error) {
    logger.trolley.error("Error fetching shelf quantities", error, { sizeIds });
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data || []) {
    // Default to 1 if shelf_quantity is null
    map.set(row.id, row.shelf_quantity ?? 1);
  }

  return map;
}
