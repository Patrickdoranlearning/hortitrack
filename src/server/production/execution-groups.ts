import "server-only";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Filter criteria for execution groups.
 * Defines which batches appear in a group.
 */
export type FilterCriteria = {
  statuses?: string[];
  phases?: string[];
  supplierIds?: string[];
  sizeIds?: string[];
  varietyIds?: string[];
  locationIds?: string[];
  weekRange?: { from?: number; to?: number };
  dateRange?: { from?: string; to?: string };
  processTypes?: string[];
};

export type ExecutionGroup = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  filterCriteria: FilterCriteria;
  sortOrder: number;
  isActive: boolean;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

export type CreateGroupInput = {
  name: string;
  description?: string;
  filterCriteria?: FilterCriteria;
  sortOrder?: number;
  color?: string;
  icon?: string;
};

export type UpdateGroupInput = {
  name?: string;
  description?: string;
  filterCriteria?: FilterCriteria;
  sortOrder?: number;
  isActive?: boolean;
  color?: string;
  icon?: string;
};

// =============================================================================
// ROW MAPPING
// =============================================================================

type GroupRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

function mapRowToGroup(row: GroupRow): ExecutionGroup {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    filterCriteria: (row.filter_criteria as FilterCriteria) ?? {},
    sortOrder: row.sort_order,
    isActive: row.is_active,
    color: row.color,
    icon: row.icon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get all execution groups for the organization.
 * If no groups exist, seeds default groups first.
 */
export async function getExecutionGroups(): Promise<ExecutionGroup[]> {
  const { supabase, orgId } = await getUserAndOrg();

  // First check if groups exist
  const { data: existing, error: checkError } = await supabase
    .from("execution_groups")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);

  if (checkError) {
    logError("[execution-groups] Error checking existing groups", { error: checkError.message });
    throw new Error(checkError.message);
  }

  // If no groups exist, seed defaults
  if (!existing || existing.length === 0) {
    const { data: seeded, error: seedError } = await supabase.rpc(
      "seed_default_execution_groups",
      { p_org_id: orgId }
    );

    if (seedError) {
      logError("[execution-groups] Error seeding default groups", { error: seedError.message });
      throw new Error(seedError.message);
    }

    return (seeded ?? []).map(mapRowToGroup);
  }

  // Fetch all groups
  const { data, error } = await supabase
    .from("execution_groups")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  if (error) {
    logError("[execution-groups] Error fetching groups", { error: error.message });
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToGroup);
}

/**
 * Get active execution groups only.
 */
export async function getActiveExecutionGroups(): Promise<ExecutionGroup[]> {
  const groups = await getExecutionGroups();
  return groups.filter((g) => g.isActive);
}

/**
 * Get a single execution group by ID.
 */
export async function getExecutionGroupById(groupId: string): Promise<ExecutionGroup | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("execution_groups")
    .select("*")
    .eq("id", groupId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logError("[execution-groups] Error fetching group", { error: error.message, groupId });
    throw new Error(error.message);
  }

  return mapRowToGroup(data);
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new execution group.
 */
export async function createGroup(input: CreateGroupInput): Promise<ExecutionGroup> {
  const { supabase, orgId, user } = await getUserAndOrg();

  // Get the next sort order if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxSort } = await supabase
      .from("execution_groups")
      .select("sort_order")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: false })
      .limit(1);

    sortOrder = (maxSort?.[0]?.sort_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("execution_groups")
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description ?? null,
      filter_criteria: input.filterCriteria ?? {},
      sort_order: sortOrder,
      color: input.color ?? null,
      icon: input.icon ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    logError("[execution-groups] Error creating group", { error: error.message });
    throw new Error(error.message);
  }

  return mapRowToGroup(data);
}

/**
 * Update an existing execution group.
 */
export async function updateGroup(
  groupId: string,
  input: UpdateGroupInput
): Promise<ExecutionGroup> {
  const { supabase, orgId } = await getUserAndOrg();

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.filterCriteria !== undefined) updateData.filter_criteria = input.filterCriteria;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;

  const { data, error } = await supabase
    .from("execution_groups")
    .update(updateData)
    .eq("id", groupId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[execution-groups] Error updating group", { error: error.message, groupId });
    throw new Error(error.message);
  }

  return mapRowToGroup(data);
}

/**
 * Delete an execution group.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("execution_groups")
    .delete()
    .eq("id", groupId)
    .eq("org_id", orgId);

  if (error) {
    logError("[execution-groups] Error deleting group", { error: error.message, groupId });
    throw new Error(error.message);
  }
}

/**
 * Reorder execution groups.
 * Accepts an array of group IDs in the desired order.
 */
export async function reorderGroups(groupIds: string[]): Promise<ExecutionGroup[]> {
  const { supabase, orgId } = await getUserAndOrg();

  // Update each group's sort_order based on position in array
  const updates = groupIds.map((id, index) => ({
    id,
    sort_order: index + 1,
  }));

  // Batch update using individual updates (Supabase doesn't support bulk update by ID)
  for (const update of updates) {
    const { error } = await supabase
      .from("execution_groups")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id)
      .eq("org_id", orgId);

    if (error) {
      logError("[execution-groups] Error reordering group", { error: error.message, groupId: update.id });
      throw new Error(error.message);
    }
  }

  // Return updated groups
  return getExecutionGroups();
}

/**
 * Toggle a group's active status.
 */
export async function toggleGroupActive(groupId: string): Promise<ExecutionGroup> {
  const { supabase, orgId } = await getUserAndOrg();

  // Get current status
  const { data: current, error: fetchError } = await supabase
    .from("execution_groups")
    .select("is_active")
    .eq("id", groupId)
    .eq("org_id", orgId)
    .single();

  if (fetchError) {
    logError("[execution-groups] Error fetching group for toggle", { error: fetchError.message, groupId });
    throw new Error(fetchError.message);
  }

  // Toggle it
  const { data, error } = await supabase
    .from("execution_groups")
    .update({ is_active: !current.is_active })
    .eq("id", groupId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    logError("[execution-groups] Error toggling group active", { error: error.message, groupId });
    throw new Error(error.message);
  }

  return mapRowToGroup(data);
}

/**
 * Reset groups to defaults.
 * Deletes all existing groups and seeds defaults.
 */
export async function resetGroupsToDefaults(): Promise<ExecutionGroup[]> {
  const { supabase, orgId } = await getUserAndOrg();

  // Delete all existing groups
  const { error: deleteError } = await supabase
    .from("execution_groups")
    .delete()
    .eq("org_id", orgId);

  if (deleteError) {
    logError("[execution-groups] Error deleting groups for reset", { error: deleteError.message });
    throw new Error(deleteError.message);
  }

  // Seed defaults
  const { data: seeded, error: seedError } = await supabase.rpc(
    "seed_default_execution_groups",
    { p_org_id: orgId }
  );

  if (seedError) {
    logError("[execution-groups] Error seeding default groups", { error: seedError.message });
    throw new Error(seedError.message);
  }

  return (seeded ?? []).map(mapRowToGroup);
}
