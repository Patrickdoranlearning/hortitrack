/**
 * Auto-assignment algorithm for bulk picking items.
 *
 * For each bulk_pick_item in a batch:
 *   1. Resolve the item's size_category_id (already set during batch creation)
 *   2. Find pickers specialized in that category (from picker_specializations,
 *      sorted by proficiency DESC)
 *   3. Among equally-proficient pickers, pick the one with the lowest current
 *      load (fewest total_qty assigned)
 *   4. Items with no matching specialization remain unassigned
 *
 * Items are processed largest-first (total_qty DESC) so the heaviest items
 * land on the most suitable picker before capacity fills up.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignmentResult {
  itemId: string;
  assignedTo: string | null;
  reason: string;
}

/** Shape returned by the bulk_pick_items query */
interface BulkPickItem {
  id: string;
  sku_id: string;
  size_category_id: string | null;
  total_qty: number;
}

/** Shape returned by the picker_specializations query */
interface PickerSpecialization {
  user_id: string;
  category_id: string;
  proficiency: number;
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

export async function autoAssignBatchItems(
  supabase: SupabaseClient,
  batchId: string,
  orgId: string,
): Promise<AssignmentResult[]> {
  // ------------------------------------------------------------------
  // Step 1: Fetch all unassigned bulk_pick_items for this batch
  // ------------------------------------------------------------------
  const { data: items, error: itemsError } = await supabase
    .from("bulk_pick_items")
    .select("id, sku_id, size_category_id, total_qty")
    .eq("bulk_batch_id", batchId)
    .is("assigned_to", null)
    .order("total_qty", { ascending: false });

  if (itemsError) {
    logger.picking.error("Auto-assign: failed to fetch batch items", itemsError, {
      batchId,
    });
    throw new Error(`Failed to fetch batch items: ${itemsError.message}`);
  }

  const typedItems = (items ?? []) as BulkPickItem[];

  if (typedItems.length === 0) {
    logger.picking.info("Auto-assign: no unassigned items in batch", { batchId });
    return [];
  }

  // ------------------------------------------------------------------
  // Step 2: Fetch all picker_specializations for this org
  // ------------------------------------------------------------------
  const { data: specializations, error: specError } = await supabase
    .from("picker_specializations")
    .select("user_id, category_id, proficiency")
    .eq("org_id", orgId);

  if (specError) {
    logger.picking.error("Auto-assign: failed to fetch specializations", specError, {
      orgId,
    });
    throw new Error(`Failed to fetch specializations: ${specError.message}`);
  }

  const typedSpecs = (specializations ?? []) as PickerSpecialization[];

  // Build a lookup: category_id -> list of { user_id, proficiency }
  const categoryPickers = new Map<string, { userId: string; proficiency: number }[]>();
  for (const spec of typedSpecs) {
    const list = categoryPickers.get(spec.category_id) ?? [];
    list.push({ userId: spec.user_id, proficiency: spec.proficiency });
    categoryPickers.set(spec.category_id, list);
  }

  // ------------------------------------------------------------------
  // Step 3: Fetch existing load per picker (items already assigned in
  //         this org, not just this batch, that are not yet completed)
  // ------------------------------------------------------------------
  const { data: existingLoads, error: loadError } = await supabase
    .from("bulk_pick_items")
    .select("assigned_to, total_qty")
    .not("assigned_to", "is", null)
    .in("status", ["pending", "in_progress"]);

  if (loadError) {
    logger.picking.warn("Auto-assign: could not fetch existing loads, using zero baseline", {
      error: loadError.message,
    });
  }

  // Running load tracker: userId -> total qty currently assigned
  const pickerLoad = new Map<string, number>();

  for (const row of existingLoads ?? []) {
    const uid = row.assigned_to as string;
    pickerLoad.set(uid, (pickerLoad.get(uid) ?? 0) + (row.total_qty as number));
  }

  // ------------------------------------------------------------------
  // Step 4: Assign items (already sorted by total_qty DESC)
  // ------------------------------------------------------------------
  const results: AssignmentResult[] = [];
  const updates: { itemId: string; assignedTo: string }[] = [];

  for (const item of typedItems) {
    // 4a. No size category -> cannot match specialization
    if (!item.size_category_id) {
      results.push({
        itemId: item.id,
        assignedTo: null,
        reason: "No size category set on item",
      });
      continue;
    }

    // 4b. Find pickers for this category
    const candidates = categoryPickers.get(item.size_category_id);
    if (!candidates || candidates.length === 0) {
      results.push({
        itemId: item.id,
        assignedTo: null,
        reason: `No pickers specialized in category ${item.size_category_id}`,
      });
      continue;
    }

    // 4c. Sort: highest proficiency first, then lowest current load
    const sorted = [...candidates].sort((a, b) => {
      // proficiency DESC
      if (b.proficiency !== a.proficiency) {
        return b.proficiency - a.proficiency;
      }
      // load ASC (lowest loaded picker first)
      const loadA = pickerLoad.get(a.userId) ?? 0;
      const loadB = pickerLoad.get(b.userId) ?? 0;
      return loadA - loadB;
    });

    const bestPicker = sorted[0];
    const currentLoad = pickerLoad.get(bestPicker.userId) ?? 0;

    results.push({
      itemId: item.id,
      assignedTo: bestPicker.userId,
      reason: `Assigned to picker (proficiency=${bestPicker.proficiency}, load=${currentLoad})`,
    });

    updates.push({ itemId: item.id, assignedTo: bestPicker.userId });

    // Update running load
    pickerLoad.set(bestPicker.userId, currentLoad + item.total_qty);
  }

  // ------------------------------------------------------------------
  // Step 5: Batch-update assigned_to values in the database
  // ------------------------------------------------------------------
  if (updates.length > 0) {
    // Supabase doesn't support batch updates with different values per row
    // in a single call, so we run individual updates. For typical batch
    // sizes (< 100 items) this is acceptable.
    const updatePromises = updates.map(({ itemId, assignedTo }) =>
      supabase
        .from("bulk_pick_items")
        .update({ assigned_to: assignedTo })
        .eq("id", itemId)
        .eq("bulk_batch_id", batchId),
    );

    const updateResults = await Promise.all(updatePromises);

    // Check for failures
    const failures = updateResults.filter((r) => r.error);
    if (failures.length > 0) {
      logger.picking.error("Auto-assign: some updates failed", undefined, {
        batchId,
        failureCount: failures.length,
        totalUpdates: updates.length,
      });
    }
  }

  logger.picking.info("Auto-assign completed", {
    batchId,
    orgId,
    totalItems: typedItems.length,
    assignedCount: updates.length,
    unassignedCount: typedItems.length - updates.length,
  });

  return results;
}
