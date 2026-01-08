import "server-only";
import { getUserAndOrg } from "@/server/auth/org";

// =============================================================================
// TYPES
// =============================================================================

export type ChecklistType = "prerequisite" | "postrequisite";
export type SourceModule = "production" | "plant_health" | "dispatch";

export type ChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  order: number;
};

export type ChecklistTemplate = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  processType: string;
  checklistType: ChecklistType;
  sourceModule: SourceModule;
  items: ChecklistItem[];
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  updatedAt: string;
  itemCount: number;
};

export type ChecklistItemProgress = {
  itemId: string;
  checked: boolean;
  skippedReason?: string;
  timestamp?: string;
};

export type ChecklistProgress = {
  prerequisites: ChecklistItemProgress[];
  postrequisites: ChecklistItemProgress[];
};

export type CreateTemplateInput = {
  name: string;
  description?: string;
  processType: string;
  checklistType: ChecklistType;
  sourceModule: SourceModule;
  items: Omit<ChecklistItem, "id">[];
};

export type UpdateTemplateInput = {
  name?: string;
  description?: string;
  processType?: string;
  items?: Omit<ChecklistItem, "id">[];
  isActive?: boolean;
};

// =============================================================================
// ROW MAPPING
// =============================================================================

type TemplateRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  process_type: string;
  checklist_type: string;
  source_module: string;
  items: ChecklistItem[];
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  created_by_name?: string | null;
  updated_at: string;
  item_count?: number;
};

function mapRowToTemplate(row: TemplateRow): ChecklistTemplate {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    processType: row.process_type,
    checklistType: row.checklist_type as ChecklistType,
    sourceModule: row.source_module as SourceModule,
    items: Array.isArray(row.items) ? row.items : [],
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    updatedAt: row.updated_at,
    itemCount: row.item_count ?? (Array.isArray(row.items) ? row.items.length : 0),
  };
}

// =============================================================================
// TEMPLATE CRUD OPERATIONS
// =============================================================================

/**
 * Get all checklist templates for the organization
 */
export async function getChecklistTemplates(filter?: {
  sourceModule?: SourceModule;
  processType?: string;
  checklistType?: ChecklistType;
  isActive?: boolean;
}): Promise<ChecklistTemplate[]> {
  const { supabase, orgId } = await getUserAndOrg();

  let query = supabase
    .from("checklist_templates_summary")
    .select("*")
    .eq("org_id", orgId)
    .order("process_type")
    .order("checklist_type")
    .order("name");

  if (filter?.sourceModule) {
    query = query.eq("source_module", filter.sourceModule);
  }
  if (filter?.processType) {
    query = query.eq("process_type", filter.processType);
  }
  if (filter?.checklistType) {
    query = query.eq("checklist_type", filter.checklistType);
  }
  if (filter?.isActive !== undefined) {
    query = query.eq("is_active", filter.isActive);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[checklist-service] Error fetching templates:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRowToTemplate);
}

/**
 * Get a single template by ID
 */
export async function getChecklistTemplateById(
  templateId: string
): Promise<ChecklistTemplate | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("checklist_templates_summary")
    .select("*")
    .eq("id", templateId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[checklist-service] Error fetching template:", error);
    throw new Error(error.message);
  }

  return mapRowToTemplate(data);
}

/**
 * Get active templates for a specific process type and module
 */
export async function getTemplatesForProcess(
  sourceModule: SourceModule,
  processType: string
): Promise<{ prerequisites: ChecklistTemplate[]; postrequisites: ChecklistTemplate[] }> {
  const templates = await getChecklistTemplates({
    sourceModule,
    processType,
    isActive: true,
  });

  return {
    prerequisites: templates.filter((t) => t.checklistType === "prerequisite"),
    postrequisites: templates.filter((t) => t.checklistType === "postrequisite"),
  };
}

/**
 * Create a new checklist template
 */
export async function createChecklistTemplate(
  input: CreateTemplateInput
): Promise<ChecklistTemplate> {
  const { supabase, orgId, user } = await getUserAndOrg();

  // Add IDs to items
  const itemsWithIds: ChecklistItem[] = input.items.map((item, index) => ({
    id: crypto.randomUUID(),
    label: item.label,
    required: item.required,
    order: item.order ?? index,
  }));

  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description ?? null,
      process_type: input.processType,
      checklist_type: input.checklistType,
      source_module: input.sourceModule,
      items: itemsWithIds,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[checklist-service] Error creating template:", error);
    throw new Error(error.message);
  }

  // Fetch from view to get computed fields
  const template = await getChecklistTemplateById(data.id);
  if (template) return template;

  return mapRowToTemplate(data);
}

/**
 * Update a checklist template
 */
export async function updateChecklistTemplate(
  templateId: string,
  input: UpdateTemplateInput
): Promise<ChecklistTemplate> {
  const { supabase, orgId } = await getUserAndOrg();

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.processType !== undefined) updateData.process_type = input.processType;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  if (input.items !== undefined) {
    // Add IDs to new items, preserve existing IDs
    const itemsWithIds: ChecklistItem[] = input.items.map((item, index) => ({
      id: (item as ChecklistItem).id ?? crypto.randomUUID(),
      label: item.label,
      required: item.required,
      order: item.order ?? index,
    }));
    updateData.items = itemsWithIds;
  }

  const { data, error } = await supabase
    .from("checklist_templates")
    .update(updateData)
    .eq("id", templateId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[checklist-service] Error updating template:", error);
    throw new Error(error.message);
  }

  const template = await getChecklistTemplateById(templateId);
  if (template) return template;

  return mapRowToTemplate(data);
}

/**
 * Delete a checklist template
 */
export async function deleteChecklistTemplate(templateId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("checklist_templates")
    .delete()
    .eq("id", templateId)
    .eq("org_id", orgId);

  if (error) {
    console.error("[checklist-service] Error deleting template:", error);
    throw new Error(error.message);
  }
}

// =============================================================================
// CHECKLIST PROGRESS HELPERS
// =============================================================================

/**
 * Initialize checklist progress from templates
 */
export function initializeChecklistProgress(
  prerequisites: ChecklistTemplate[],
  postrequisites: ChecklistTemplate[]
): ChecklistProgress {
  const allPrereqItems = prerequisites.flatMap((t) => t.items);
  const allPostreqItems = postrequisites.flatMap((t) => t.items);

  return {
    prerequisites: allPrereqItems.map((item) => ({
      itemId: item.id,
      checked: false,
    })),
    postrequisites: allPostreqItems.map((item) => ({
      itemId: item.id,
      checked: false,
    })),
  };
}

/**
 * Update a single checklist item progress
 */
export function updateChecklistItemProgress(
  progress: ChecklistProgress,
  checklistType: ChecklistType,
  itemId: string,
  checked: boolean,
  skippedReason?: string
): ChecklistProgress {
  const list = checklistType === "prerequisite" ? progress.prerequisites : progress.postrequisites;
  
  const updatedList = list.map((item) => {
    if (item.itemId === itemId) {
      return {
        ...item,
        checked,
        skippedReason: checked ? undefined : skippedReason,
        timestamp: new Date().toISOString(),
      };
    }
    return item;
  });

  return {
    ...progress,
    [checklistType === "prerequisite" ? "prerequisites" : "postrequisites"]: updatedList,
  };
}

/**
 * Check if all items in a checklist are completed or skipped
 */
export function isChecklistComplete(
  progress: ChecklistProgress,
  checklistType: ChecklistType,
  templates: ChecklistTemplate[]
): { complete: boolean; uncheckedCount: number; uncheckedItems: ChecklistItem[] } {
  const items = templates.flatMap((t) => t.items);
  const progressList = checklistType === "prerequisite" 
    ? progress.prerequisites 
    : progress.postrequisites;

  const uncheckedItems: ChecklistItem[] = [];

  for (const item of items) {
    const progressItem = progressList.find((p) => p.itemId === item.id);
    const isCheckedOrSkipped = progressItem?.checked || progressItem?.skippedReason;
    
    if (!isCheckedOrSkipped) {
      uncheckedItems.push(item);
    }
  }

  return {
    complete: uncheckedItems.length === 0,
    uncheckedCount: uncheckedItems.length,
    uncheckedItems,
  };
}

/**
 * Get checklist summary for display
 */
export function getChecklistSummary(
  progress: ChecklistProgress,
  templates: ChecklistTemplate[]
): {
  prerequisites: { total: number; checked: number; skipped: number };
  postrequisites: { total: number; checked: number; skipped: number };
} {
  const prereqItems = templates
    .filter((t) => t.checklistType === "prerequisite")
    .flatMap((t) => t.items);
  const postreqItems = templates
    .filter((t) => t.checklistType === "postrequisite")
    .flatMap((t) => t.items);

  const countProgress = (items: ChecklistItem[], progressList: ChecklistItemProgress[]) => {
    let checked = 0;
    let skipped = 0;

    for (const item of items) {
      const p = progressList.find((prog) => prog.itemId === item.id);
      if (p?.checked) checked++;
      else if (p?.skippedReason) skipped++;
    }

    return { total: items.length, checked, skipped };
  };

  return {
    prerequisites: countProgress(prereqItems, progress.prerequisites),
    postrequisites: countProgress(postreqItems, progress.postrequisites),
  };
}

// =============================================================================
// PROCESS TYPE HELPERS
// =============================================================================

export const PROCESS_TYPES = {
  production: [
    { value: "potting", label: "Potting" },
    { value: "propagation", label: "Propagation" },
    { value: "transplant", label: "Transplant" },
    { value: "spacing", label: "Spacing" },
    { value: "other", label: "Other" },
  ],
  plant_health: [
    { value: "spraying", label: "Spraying" },
    { value: "ipm_release", label: "IPM Release" },
    { value: "scouting", label: "Scouting" },
    { value: "treatment", label: "Treatment" },
  ],
  dispatch: [
    { value: "picking", label: "Picking" },
    { value: "packing", label: "Packing" },
    { value: "loading", label: "Loading" },
    { value: "delivery", label: "Delivery" },
  ],
} as const;

export function getProcessTypesForModule(module: SourceModule) {
  return PROCESS_TYPES[module] ?? [];
}

