import { SupabaseClient } from "@supabase/supabase-js";
import { generatePartNumber, generateInternalBarcode } from "@/server/numbering/materials";
import type {
  Material,
  MaterialCategory,
  MaterialWithStock,
  CreateMaterialInput,
  UpdateMaterialInput,
} from "@/lib/types/materials";

// ============================================================================
// Categories (shared - no org filtering)
// ============================================================================

export async function listCategories(
  supabase: SupabaseClient
): Promise<MaterialCategory[]> {
  const { data, error } = await supabase
    .from("material_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);

  return (data ?? []).map(mapCategory);
}

export async function getCategoryByCode(
  supabase: SupabaseClient,
  code: string
): Promise<MaterialCategory | null> {
  const { data, error } = await supabase
    .from("material_categories")
    .select("*")
    .eq("code", code)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch category: ${error.message}`);
  }

  return data ? mapCategory(data) : null;
}

// ============================================================================
// Materials CRUD
// ============================================================================

export async function listMaterials(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    categoryId?: string;
    categoryCode?: string;
    linkedSizeId?: string;
    supplierId?: string;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ materials: Material[]; total: number }> {
  let query = supabase
    .from("materials")
    .select(
      `
      *,
      category:material_categories(*),
      linked_size:plant_sizes(id, name, container_type),
      default_supplier:suppliers(id, name)
    `,
      { count: "exact" }
    )
    .eq("org_id", orgId);

  if (options?.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  if (options?.categoryCode) {
    // Need to join through category
    query = query.eq("category.code", options.categoryCode);
  }

  if (options?.linkedSizeId) {
    query = query.eq("linked_size_id", options.linkedSizeId);
  }

  if (options?.supplierId) {
    query = query.eq("default_supplier_id", options.supplierId);
  }

  if (options?.isActive !== undefined) {
    query = query.eq("is_active", options.isActive);
  }

  if (options?.search) {
    query = query.or(
      `name.ilike.%${options.search}%,part_number.ilike.%${options.search}%,description.ilike.%${options.search}%`
    );
  }

  query = query
    .order("part_number", { ascending: true })
    .range(
      options?.offset ?? 0,
      (options?.offset ?? 0) + (options?.limit ?? 100) - 1
    );

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch materials: ${error.message}`);

  return {
    materials: (data ?? []).map(mapMaterial),
    total: count ?? 0,
  };
}

export async function getMaterial(
  supabase: SupabaseClient,
  orgId: string,
  id: string
): Promise<Material | null> {
  const { data, error } = await supabase
    .from("materials")
    .select(
      `
      *,
      category:material_categories(*),
      linked_size:plant_sizes(id, name, container_type),
      default_supplier:suppliers(id, name)
    `
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch material: ${error.message}`);
  }

  return data ? mapMaterial(data) : null;
}

export async function getMaterialByPartNumber(
  supabase: SupabaseClient,
  orgId: string,
  partNumber: string
): Promise<Material | null> {
  const { data, error } = await supabase
    .from("materials")
    .select(
      `
      *,
      category:material_categories(*),
      linked_size:plant_sizes(id, name, container_type),
      default_supplier:suppliers(id, name)
    `
    )
    .eq("org_id", orgId)
    .eq("part_number", partNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch material: ${error.message}`);
  }

  return data ? mapMaterial(data) : null;
}

export async function createMaterial(
  supabase: SupabaseClient,
  orgId: string,
  input: CreateMaterialInput
): Promise<Material> {
  // Get category code for part number generation
  const { data: category, error: catError } = await supabase
    .from("material_categories")
    .select("code")
    .eq("id", input.categoryId)
    .single();

  if (catError || !category) {
    throw new Error("Invalid category");
  }

  // Generate part number
  const partNumber = await generatePartNumber(category.code);

  // Generate internal barcode
  const internalBarcode = generateInternalBarcode(orgId, partNumber);

  const { data, error } = await supabase
    .from("materials")
    .insert({
      org_id: orgId,
      part_number: partNumber,
      name: input.name,
      description: input.description ?? null,
      category_id: input.categoryId,
      linked_size_id: input.linkedSizeId ?? null,
      base_uom: input.baseUom ?? "each",
      default_supplier_id: input.defaultSupplierId ?? null,
      reorder_point: input.reorderPoint ?? null,
      reorder_quantity: input.reorderQuantity ?? null,
      target_stock: input.targetStock ?? null,
      standard_cost: input.standardCost ?? null,
      barcode: input.barcode ?? null,
      internal_barcode: internalBarcode,
      is_active: true,
    })
    .select(
      `
      *,
      category:material_categories(*),
      linked_size:plant_sizes(id, name, container_type),
      default_supplier:suppliers(id, name)
    `
    )
    .single();

  if (error) throw new Error(`Failed to create material: ${error.message}`);

  return mapMaterial(data);
}

export async function updateMaterial(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
  input: UpdateMaterialInput
): Promise<Material> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.categoryId !== undefined) updateData.category_id = input.categoryId;
  if (input.linkedSizeId !== undefined) updateData.linked_size_id = input.linkedSizeId;
  if (input.baseUom !== undefined) updateData.base_uom = input.baseUom;
  if (input.defaultSupplierId !== undefined) updateData.default_supplier_id = input.defaultSupplierId;
  if (input.reorderPoint !== undefined) updateData.reorder_point = input.reorderPoint;
  if (input.reorderQuantity !== undefined) updateData.reorder_quantity = input.reorderQuantity;
  if (input.targetStock !== undefined) updateData.target_stock = input.targetStock;
  if (input.standardCost !== undefined) updateData.standard_cost = input.standardCost;
  if (input.barcode !== undefined) updateData.barcode = input.barcode;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  const { data, error } = await supabase
    .from("materials")
    .update(updateData)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(
      `
      *,
      category:material_categories(*),
      linked_size:plant_sizes(id, name, container_type),
      default_supplier:suppliers(id, name)
    `
    )
    .single();

  if (error) throw new Error(`Failed to update material: ${error.message}`);

  return mapMaterial(data);
}

export async function deleteMaterial(
  supabase: SupabaseClient,
  orgId: string,
  id: string
): Promise<void> {
  // Soft delete - set is_active to false
  const { error } = await supabase
    .from("materials")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(`Failed to delete material: ${error.message}`);
}

// ============================================================================
// Materials by Size (for auto-consumption)
// ============================================================================

export async function getMaterialsForSize(
  supabase: SupabaseClient,
  orgId: string,
  sizeId: string
): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(
      `
      *,
      category:material_categories(*)
    `
    )
    .eq("org_id", orgId)
    .eq("linked_size_id", sizeId)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch materials for size: ${error.message}`);

  return (data ?? []).map(mapMaterial);
}

// ============================================================================
// Mappers
// ============================================================================

function mapCategory(row: Record<string, unknown>): MaterialCategory {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    parentGroup: row.parent_group as string,
    consumptionType: row.consumption_type as "per_unit" | "proportional" | "fixed",
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function mapMaterial(row: Record<string, unknown>): Material {
  const category = row.category as Record<string, unknown> | null;
  const linkedSize = row.linked_size as Record<string, unknown> | null;
  const defaultSupplier = row.default_supplier as Record<string, unknown> | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    partNumber: row.part_number as string,
    name: row.name as string,
    description: row.description as string | null,
    categoryId: row.category_id as string,
    category: category ? mapCategory(category) : undefined,
    linkedSizeId: row.linked_size_id as string | null,
    linkedSize: linkedSize
      ? {
          id: linkedSize.id as string,
          name: linkedSize.name as string,
          containerType: linkedSize.container_type as string | undefined,
        }
      : null,
    baseUom: row.base_uom as "each" | "litre" | "kg" | "ml" | "g",
    defaultSupplierId: row.default_supplier_id as string | null,
    defaultSupplier: defaultSupplier
      ? {
          id: defaultSupplier.id as string,
          name: defaultSupplier.name as string,
        }
      : null,
    reorderPoint: row.reorder_point as number | null,
    reorderQuantity: row.reorder_quantity as number | null,
    targetStock: row.target_stock as number | null,
    standardCost: row.standard_cost as number | null,
    barcode: row.barcode as string | null,
    internalBarcode: row.internal_barcode as string | null,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
