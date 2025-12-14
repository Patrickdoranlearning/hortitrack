import { SupabaseClient } from "@supabase/supabase-js";
import type { MaterialStock, MaterialStockSummary, MaterialTransaction } from "@/lib/types/materials";

// ============================================================================
// Stock Queries
// ============================================================================

export async function getStockSummary(
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  materialId: string;
  materialName: string;
  partNumber: string;
  categoryName: string;
  baseUom: string;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  reorderPoint: number | null;
  isLowStock: boolean;
}[]> {
  const { data, error } = await supabase
    .from("material_stock")
    .select(`
      material_id,
      quantity_on_hand,
      quantity_reserved,
      materials!inner (
        id,
        name,
        part_number,
        base_uom,
        reorder_point,
        is_active,
        material_categories (name)
      )
    `)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to fetch stock summary: ${error.message}`);

  // Aggregate by material
  const aggregated = new Map<string, {
    materialId: string;
    materialName: string;
    partNumber: string;
    categoryName: string;
    baseUom: string;
    totalOnHand: number;
    totalReserved: number;
    reorderPoint: number | null;
  }>();

  for (const row of data ?? []) {
    const material = row.materials as any;
    if (!material?.is_active) continue;

    const existing = aggregated.get(row.material_id);
    if (existing) {
      existing.totalOnHand += Number(row.quantity_on_hand) || 0;
      existing.totalReserved += Number(row.quantity_reserved) || 0;
    } else {
      aggregated.set(row.material_id, {
        materialId: row.material_id,
        materialName: material.name,
        partNumber: material.part_number,
        categoryName: material.material_categories?.name ?? 'Unknown',
        baseUom: material.base_uom,
        totalOnHand: Number(row.quantity_on_hand) || 0,
        totalReserved: Number(row.quantity_reserved) || 0,
        reorderPoint: material.reorder_point,
      });
    }
  }

  return Array.from(aggregated.values()).map((item) => ({
    ...item,
    totalAvailable: item.totalOnHand - item.totalReserved,
    isLowStock: item.reorderPoint !== null && item.totalOnHand < item.reorderPoint,
  }));
}

export async function getStockByMaterial(
  supabase: SupabaseClient,
  orgId: string,
  materialId: string
): Promise<MaterialStock[]> {
  const { data, error } = await supabase
    .from("material_stock")
    .select(`
      *,
      location:nursery_locations (id, name)
    `)
    .eq("org_id", orgId)
    .eq("material_id", materialId);

  if (error) throw new Error(`Failed to fetch stock by material: ${error.message}`);

  return (data ?? []).map(mapStock);
}

export async function getStockAtLocation(
  supabase: SupabaseClient,
  orgId: string,
  materialId: string,
  locationId: string | null
): Promise<MaterialStock | null> {
  let query = supabase
    .from("material_stock")
    .select("*")
    .eq("org_id", orgId)
    .eq("material_id", materialId);

  if (locationId) {
    query = query.eq("location_id", locationId);
  } else {
    query = query.is("location_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(`Failed to fetch stock at location: ${error.message}`);

  return data ? mapStock(data) : null;
}

// ============================================================================
// Stock Movements
// ============================================================================

export async function adjustStock(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  materialId: string,
  locationId: string | null,
  quantity: number,
  reason: string,
  notes?: string
): Promise<MaterialTransaction> {
  const { data, error } = await supabase
    .from("material_transactions")
    .insert({
      org_id: orgId,
      material_id: materialId,
      transaction_type: "adjust",
      quantity,
      uom: "each", // Will be updated by trigger from material
      from_location_id: locationId,
      reference: reason,
      notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to adjust stock: ${error.message}`);

  return mapTransaction(data);
}

export async function transferStock(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  materialId: string,
  fromLocationId: string | null,
  toLocationId: string,
  quantity: number,
  notes?: string
): Promise<MaterialTransaction> {
  // Check available stock at source
  const sourceStock = await getStockAtLocation(supabase, orgId, materialId, fromLocationId);
  if (!sourceStock || sourceStock.quantityAvailable < quantity) {
    throw new Error(`Insufficient stock at source location. Available: ${sourceStock?.quantityAvailable ?? 0}`);
  }

  const { data, error } = await supabase
    .from("material_transactions")
    .insert({
      org_id: orgId,
      material_id: materialId,
      transaction_type: "transfer",
      quantity: Math.abs(quantity),
      uom: "each",
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      reference: "Stock transfer",
      notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to transfer stock: ${error.message}`);

  return mapTransaction(data);
}

export async function recordCount(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  materialId: string,
  locationId: string | null,
  countedQuantity: number,
  notes?: string
): Promise<MaterialTransaction> {
  // Get current stock to calculate adjustment
  const currentStock = await getStockAtLocation(supabase, orgId, materialId, locationId);
  const currentQty = currentStock?.quantityOnHand ?? 0;
  const adjustment = countedQuantity - currentQty;

  if (adjustment === 0) {
    // No adjustment needed, just record the count
    const { error: updateError } = await supabase
      .from("material_stock")
      .update({ last_counted_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("material_id", materialId)
      .eq("location_id", locationId ?? null);

    if (updateError) {
      console.error("Failed to update last_counted_at:", updateError);
    }

    // Return a synthetic transaction for the count
    return {
      id: crypto.randomUUID(),
      orgId,
      materialId,
      transactionType: "count",
      quantity: 0,
      uom: "each",
      fromLocationId: locationId,
      toLocationId: null,
      reference: "Physical count - no adjustment",
      notes,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from("material_transactions")
    .insert({
      org_id: orgId,
      material_id: materialId,
      transaction_type: "count",
      quantity: adjustment,
      uom: "each",
      from_location_id: locationId,
      reference: `Physical count: ${currentQty} → ${countedQuantity}`,
      notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record count: ${error.message}`);

  // Update last_counted_at
  await supabase
    .from("material_stock")
    .update({ last_counted_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("material_id", materialId)
    .eq("location_id", locationId ?? null);

  return mapTransaction(data);
}

// ============================================================================
// Transaction History
// ============================================================================

export async function getTransactions(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    materialId?: string;
    transactionType?: string;
    batchId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ transactions: MaterialTransaction[]; total: number }> {
  let query = supabase
    .from("material_transactions")
    .select(
      `
      *,
      material:materials (id, name, part_number),
      from_location:nursery_locations!from_location_id (id, name),
      to_location:nursery_locations!to_location_id (id, name),
      batch:batches (id, batch_number)
    `,
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (options?.materialId) {
    query = query.eq("material_id", options.materialId);
  }
  if (options?.transactionType) {
    query = query.eq("transaction_type", options.transactionType);
  }
  if (options?.batchId) {
    query = query.eq("batch_id", options.batchId);
  }
  if (options?.fromDate) {
    query = query.gte("created_at", options.fromDate);
  }
  if (options?.toDate) {
    query = query.lte("created_at", options.toDate);
  }

  query = query.range(
    options?.offset ?? 0,
    (options?.offset ?? 0) + (options?.limit ?? 100) - 1
  );

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);

  return {
    transactions: (data ?? []).map(mapTransaction),
    total: count ?? 0,
  };
}

// ============================================================================
// Mappers
// ============================================================================

function mapStock(row: Record<string, unknown>): MaterialStock {
  const location = row.location as Record<string, unknown> | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    materialId: row.material_id as string,
    locationId: row.location_id as string | null,
    location: location ? { id: location.id as string, name: location.name as string } : null,
    quantityOnHand: Number(row.quantity_on_hand) || 0,
    quantityReserved: Number(row.quantity_reserved) || 0,
    quantityAvailable: Number(row.quantity_available) || 0,
    lastCountedAt: row.last_counted_at as string | null,
    lastMovementAt: row.last_movement_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapTransaction(row: Record<string, unknown>): MaterialTransaction {
  const material = row.material as Record<string, unknown> | null;
  const fromLocation = row.from_location as Record<string, unknown> | null;
  const toLocation = row.to_location as Record<string, unknown> | null;
  const batch = row.batch as Record<string, unknown> | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    materialId: row.material_id as string,
    material: material
      ? {
          id: material.id as string,
          name: material.name as string,
          partNumber: material.part_number as string,
        } as any
      : undefined,
    transactionType: row.transaction_type as MaterialTransaction["transactionType"],
    quantity: Number(row.quantity) || 0,
    uom: row.uom as string,
    fromLocationId: row.from_location_id as string | null,
    fromLocation: fromLocation ? { id: fromLocation.id as string, name: fromLocation.name as string } : null,
    toLocationId: row.to_location_id as string | null,
    toLocation: toLocation ? { id: toLocation.id as string, name: toLocation.name as string } : null,
    purchaseOrderLineId: row.purchase_order_line_id as string | null,
    batchId: row.batch_id as string | null,
    batch: batch ? { id: batch.id as string, batchNumber: batch.batch_number as string } : null,
    quantityAfter: row.quantity_after as number | null,
    reference: row.reference as string | null,
    notes: row.notes as string | null,
    costPerUnit: row.cost_per_unit as number | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}
