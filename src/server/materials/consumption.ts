import { SupabaseClient } from "@supabase/supabase-js";
import type { MaterialTransaction } from "@/lib/types/materials";

// Local type for consumption preview - uses different property names than shared types
type LocalConsumptionPreview = {
  materialId: string;
  materialName: string;
  partNumber: string;
  baseUom: string;
  quantityRequired: number;
  quantityAvailable: number;
  isShortage: boolean;
};

// Helper to extract joined record (Supabase may return array or object)
function extractJoin<T extends Record<string, unknown>>(joined: unknown): T | null {
  if (!joined) return null;
  if (Array.isArray(joined)) return joined[0] as T ?? null;
  return joined as T;
}

// ============================================================================
// Consumption Rules
// ============================================================================

export type ConsumptionRule = {
  id: string;
  materialId: string;
  materialName: string;
  materialPartNumber: string;
  sizeId: string;
  quantityPerUnit: number;
  baseUom: string;
};

export async function getConsumptionRules(
  supabase: SupabaseClient,
  orgId: string,
  sizeId: string
): Promise<ConsumptionRule[]> {
  const { data, error } = await supabase
    .from("material_consumption_rules")
    .select(`
      id,
      material_id,
      size_id,
      quantity_per_unit,
      material:materials (id, name, part_number, base_uom)
    `)
    .eq("org_id", orgId)
    .eq("size_id", sizeId);

  if (error) throw new Error(`Failed to fetch consumption rules: ${error.message}`);

  return (data ?? []).map((row) => {
    const material = extractJoin<Record<string, unknown>>(row.material);
    return {
      id: row.id,
      materialId: row.material_id,
      materialName: material?.name as string ?? "Unknown",
      materialPartNumber: material?.part_number as string ?? "",
      sizeId: row.size_id,
      quantityPerUnit: Number(row.quantity_per_unit) || 0,
      baseUom: material?.base_uom as string ?? "each",
    };
  });
}

export async function upsertConsumptionRules(
  supabase: SupabaseClient,
  orgId: string,
  rules: { materialId: string; sizeId: string; quantityPerUnit: number }[]
): Promise<void> {
  // Delete existing rules for these material/size combinations
  const combinations = rules.map((r) => `${r.materialId}:${r.sizeId}`);

  for (const rule of rules) {
    await supabase
      .from("material_consumption_rules")
      .delete()
      .eq("org_id", orgId)
      .eq("material_id", rule.materialId)
      .eq("size_id", rule.sizeId);
  }

  // Insert new rules
  if (rules.length > 0) {
    const { error } = await supabase.from("material_consumption_rules").insert(
      rules.map((r) => ({
        org_id: orgId,
        material_id: r.materialId,
        size_id: r.sizeId,
        quantity_per_unit: r.quantityPerUnit,
      }))
    );

    if (error) throw new Error(`Failed to save consumption rules: ${error.message}`);
  }
}

// ============================================================================
// Auto-consumption based on linked materials
// ============================================================================

export async function getMaterialsForSize(
  supabase: SupabaseClient,
  orgId: string,
  sizeId: string
): Promise<{
  id: string;
  name: string;
  partNumber: string;
  baseUom: string;
  categoryCode: string;
  consumptionType: "per_unit" | "proportional" | "fixed";
}[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(`
      id,
      name,
      part_number,
      base_uom,
      category:material_categories (code, consumption_type)
    `)
    .eq("org_id", orgId)
    .eq("linked_size_id", sizeId)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch linked materials: ${error.message}`);

  return (data ?? []).map((row) => {
    const category = extractJoin<Record<string, unknown>>(row.category);
    return {
      id: row.id,
      name: row.name,
      partNumber: row.part_number,
      baseUom: row.base_uom,
      categoryCode: category?.code as string ?? "",
      consumptionType: (category?.consumption_type as "per_unit" | "proportional" | "fixed") ?? "per_unit",
    };
  });
}

// ============================================================================
// Consumption Preview
// ============================================================================

export async function previewConsumption(
  supabase: SupabaseClient,
  orgId: string,
  sizeId: string,
  quantity: number
): Promise<LocalConsumptionPreview[]> {
  // Get materials linked to this size
  const linkedMaterials = await getMaterialsForSize(supabase, orgId, sizeId);

  // Get consumption rules for this size
  const rules = await getConsumptionRules(supabase, orgId, sizeId);

  // Get current stock for these materials
  const materialIds = [...new Set([
    ...linkedMaterials.map((m) => m.id),
    ...rules.map((r) => r.materialId),
  ])];

  if (materialIds.length === 0) {
    return [];
  }

  const { data: stockData, error: stockError } = await supabase
    .from("material_stock")
    .select("material_id, quantity_on_hand, quantity_reserved")
    .eq("org_id", orgId)
    .in("material_id", materialIds);

  if (stockError) throw new Error(`Failed to fetch stock: ${stockError.message}`);

  // Aggregate stock by material
  const stockByMaterial = new Map<string, number>();
  (stockData ?? []).forEach((row) => {
    const available = Number(row.quantity_on_hand) - Number(row.quantity_reserved);
    const existing = stockByMaterial.get(row.material_id) ?? 0;
    stockByMaterial.set(row.material_id, existing + available);
  });

  // Build preview
  const previews: LocalConsumptionPreview[] = [];

  // Add linked materials (per_unit consumption)
  for (const material of linkedMaterials) {
    let quantityRequired: number;

    switch (material.consumptionType) {
      case "per_unit":
        quantityRequired = quantity; // 1:1 ratio
        break;
      case "proportional":
        // Get rule if exists, otherwise assume 1
        const rule = rules.find((r) => r.materialId === material.id);
        quantityRequired = quantity * (rule?.quantityPerUnit ?? 1);
        break;
      case "fixed":
        // Fixed amount regardless of quantity (e.g., setup materials)
        const fixedRule = rules.find((r) => r.materialId === material.id);
        quantityRequired = fixedRule?.quantityPerUnit ?? 1;
        break;
      default:
        quantityRequired = quantity;
    }

    const available = stockByMaterial.get(material.id) ?? 0;

    previews.push({
      materialId: material.id,
      materialName: material.name,
      partNumber: material.partNumber,
      baseUom: material.baseUom,
      quantityRequired,
      quantityAvailable: available,
      isShortage: available < quantityRequired,
    });
  }

  // Add rule-based materials that aren't already linked
  for (const rule of rules) {
    if (previews.some((p) => p.materialId === rule.materialId)) continue;

    const available = stockByMaterial.get(rule.materialId) ?? 0;
    const quantityRequired = quantity * rule.quantityPerUnit;

    previews.push({
      materialId: rule.materialId,
      materialName: rule.materialName,
      partNumber: rule.materialPartNumber,
      baseUom: rule.baseUom,
      quantityRequired,
      quantityAvailable: available,
      isShortage: available < quantityRequired,
    });
  }

  return previews;
}

// ============================================================================
// Consumption Execution
// ============================================================================

export type ConsumptionResult = {
  success: boolean;
  transactions: MaterialTransaction[];
  shortages: {
    materialId: string;
    materialName: string;
    required: number;
    available: number;
  }[];
};

export async function consumeMaterialsForBatch(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  batchId: string,
  batchNumber: string,
  sizeId: string,
  quantity: number,
  locationId?: string | null,
  allowPartial: boolean = false
): Promise<ConsumptionResult> {
  // Get consumption preview
  const preview = await previewConsumption(supabase, orgId, sizeId, quantity);

  if (preview.length === 0) {
    return { success: true, transactions: [], shortages: [] };
  }

  // Check for shortages
  const shortages = preview
    .filter((p) => p.isShortage)
    .map((p) => ({
      materialId: p.materialId,
      materialName: p.materialName,
      required: p.quantityRequired,
      available: p.quantityAvailable,
    }));

  if (shortages.length > 0 && !allowPartial) {
    return { success: false, transactions: [], shortages };
  }

  // Create consumption transactions
  const transactions: MaterialTransaction[] = [];

  for (const item of preview) {
    // Calculate actual consumption (may be limited by availability)
    const actualQty = allowPartial
      ? Math.min(item.quantityRequired, item.quantityAvailable)
      : item.quantityRequired;

    if (actualQty <= 0) continue;

    const { data, error } = await supabase
      .from("material_transactions")
      .insert({
        org_id: orgId,
        material_id: item.materialId,
        transaction_type: "consume",
        quantity: -actualQty, // Negative for consumption
        uom: item.baseUom,
        from_location_id: locationId ?? null,
        batch_id: batchId,
        reference: `Batch ${batchNumber}`,
        notes: `Auto-consumed for batch actualization`,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to create consumption transaction for ${item.materialId}:`, error);
      continue;
    }

    transactions.push({
      id: data.id,
      orgId: data.org_id,
      materialId: data.material_id,
      transactionType: "consume",
      quantity: Number(data.quantity),
      uom: data.uom,
      fromLocationId: data.from_location_id,
      toLocationId: null,
      batchId: data.batch_id,
      reference: data.reference,
      notes: data.notes,
      createdBy: data.created_by,
      createdAt: data.created_at,
    });
  }

  return {
    success: shortages.length === 0 || allowPartial,
    transactions,
    shortages,
  };
}

// ============================================================================
// Reverse Consumption (for batch adjustments/cancellations)
// ============================================================================

export async function reverseConsumption(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  batchId: string,
  reason: string = "Batch adjustment"
): Promise<MaterialTransaction[]> {
  // Find all consumption transactions for this batch
  const { data: consumptions, error: fetchError } = await supabase
    .from("material_transactions")
    .select("*")
    .eq("org_id", orgId)
    .eq("batch_id", batchId)
    .eq("transaction_type", "consume");

  if (fetchError) throw new Error(`Failed to fetch consumption history: ${fetchError.message}`);

  if (!consumptions || consumptions.length === 0) {
    return [];
  }

  // Create return transactions
  const transactions: MaterialTransaction[] = [];

  for (const consumption of consumptions) {
    const returnQty = Math.abs(Number(consumption.quantity));

    const { data, error } = await supabase
      .from("material_transactions")
      .insert({
        org_id: orgId,
        material_id: consumption.material_id,
        transaction_type: "return",
        quantity: returnQty, // Positive for return
        uom: consumption.uom,
        to_location_id: consumption.from_location_id, // Return to original location
        batch_id: batchId,
        reference: consumption.reference,
        notes: reason,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to create return transaction for ${consumption.material_id}:`, error);
      continue;
    }

    transactions.push({
      id: data.id,
      orgId: data.org_id,
      materialId: data.material_id,
      transactionType: "return",
      quantity: Number(data.quantity),
      uom: data.uom,
      fromLocationId: null,
      toLocationId: data.to_location_id,
      batchId: data.batch_id,
      reference: data.reference,
      notes: data.notes,
      createdBy: data.created_by,
      createdAt: data.created_at,
    });
  }

  return transactions;
}
