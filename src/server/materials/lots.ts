import { SupabaseClient } from "@supabase/supabase-js";
import { generateLotNumber, generateLotBarcode } from "@/server/numbering/materials";
import { logError } from "@/lib/log";
import type {
  MaterialLot,
  MaterialLotWithMaterial,
  MaterialLotTransaction,
  MaterialLotStatus,
  MaterialLotUnitType,
  AvailableLot,
  FifoSelectionResult,
  BatchMaterialLot,
  CreateMaterialLotInput,
  AdjustLotInput,
  TransferLotInput,
  ConsumeLotInput,
  MaterialLotFilters,
  MaterialLotSortField,
  MaterialLotSortOrder,
} from "@/lib/types/material-lots";
import type {
  MaterialCategoryCode,
  MaterialParentGroup,
} from "@/lib/types/materials";

// ============================================================================
// Lot CRUD Operations
// ============================================================================

/**
 * List material lots with optional filters
 */
export async function listMaterialLots(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    filters?: MaterialLotFilters;
    sortField?: MaterialLotSortField;
    sortOrder?: MaterialLotSortOrder;
    limit?: number;
    offset?: number;
  }
): Promise<{ lots: MaterialLotWithMaterial[]; total: number }> {
  let query = supabase
    .from("material_lots")
    .select(
      `
      *,
      material:materials(
        *,
        category:material_categories(*)
      ),
      supplier:suppliers(id, name),
      location:nursery_locations(id, name)
    `,
      { count: "exact" }
    )
    .eq("org_id", orgId);

  const filters = options?.filters;

  if (filters?.materialId) {
    query = query.eq("material_id", filters.materialId);
  }

  if (filters?.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters?.supplierId) {
    query = query.eq("supplier_id", filters.supplierId);
  }

  if (filters?.hasStock === true) {
    query = query.gt("current_quantity", 0);
  } else if (filters?.hasStock === false) {
    query = query.eq("current_quantity", 0);
  }

  if (filters?.expiringWithinDays !== undefined) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
    query = query
      .not("expiry_date", "is", null)
      .lte("expiry_date", futureDate.toISOString().split("T")[0]);
  }

  if (filters?.search) {
    // Sanitize search input to prevent SQL injection via special characters
    const sanitizedSearch = filters.search.replace(/[%_\\]/g, '\\$&');
    query = query.or(
      `lot_number.ilike.%${sanitizedSearch}%,supplier_lot_number.ilike.%${sanitizedSearch}%`
    );
  }

  // Sorting
  const sortField = options?.sortField ?? "receivedAt";
  const sortOrder = options?.sortOrder ?? "asc";
  const sortColumn = mapSortField(sortField);
  query = query.order(sortColumn, { ascending: sortOrder === "asc" });

  // Pagination
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 100;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch material lots: ${error.message}`);

  return {
    lots: (data ?? []).map(mapMaterialLot) as MaterialLotWithMaterial[],
    total: count ?? 0,
  };
}

/**
 * Get a single material lot by ID
 */
export async function getMaterialLot(
  supabase: SupabaseClient,
  orgId: string,
  lotId: string
): Promise<MaterialLotWithMaterial | null> {
  const { data, error } = await supabase
    .from("material_lots")
    .select(
      `
      *,
      material:materials(
        *,
        category:material_categories(*)
      ),
      supplier:suppliers(id, name),
      location:nursery_locations(id, name),
      purchase_order_line:purchase_order_lines(
        id,
        purchase_order_id,
        purchase_order:purchase_orders(id, po_number)
      )
    `
    )
    .eq("org_id", orgId)
    .eq("id", lotId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch material lot: ${error.message}`);
  }

  return data ? (mapMaterialLot(data) as MaterialLotWithMaterial) : null;
}

/**
 * Get a material lot by lot number
 */
export async function getMaterialLotByNumber(
  supabase: SupabaseClient,
  orgId: string,
  lotNumber: string
): Promise<MaterialLotWithMaterial | null> {
  const { data, error } = await supabase
    .from("material_lots")
    .select(
      `
      *,
      material:materials(
        *,
        category:material_categories(*)
      ),
      supplier:suppliers(id, name),
      location:nursery_locations(id, name)
    `
    )
    .eq("org_id", orgId)
    .eq("lot_number", lotNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch material lot: ${error.message}`);
  }

  return data ? (mapMaterialLot(data) as MaterialLotWithMaterial) : null;
}

/**
 * Get a material lot by barcode
 */
export async function getMaterialLotByBarcode(
  supabase: SupabaseClient,
  orgId: string,
  barcode: string
): Promise<MaterialLotWithMaterial | null> {
  // Include org_id in query filter for security (not just post-query validation)
  const { data, error } = await supabase
    .from("material_lots")
    .select(
      `
      *,
      material:materials(
        *,
        category:material_categories(*)
      ),
      supplier:suppliers(id, name),
      location:nursery_locations(id, name)
    `
    )
    .eq("org_id", orgId)
    .eq("lot_barcode", barcode)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch material lot: ${error.message}`);
  }

  return data ? (mapMaterialLot(data) as MaterialLotWithMaterial) : null;
}

// ============================================================================
// Lot Receipt Operations
// ============================================================================

/**
 * Receive new material lots (ad-hoc receipt without PO)
 */
export async function receiveMaterialLots(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  materialId: string,
  lots: Omit<CreateMaterialLotInput, "materialId">[],
  locationId?: string | null,
  notes?: string
): Promise<MaterialLot[]> {
  // Get material details for lot number generation
  const { data: material, error: matError } = await supabase
    .from("materials")
    .select("part_number, base_uom")
    .eq("org_id", orgId)
    .eq("id", materialId)
    .single();

  if (matError || !material) {
    throw new Error("Material not found");
  }

  const createdLots: MaterialLot[] = [];

  for (const lotInput of lots) {
    // Generate lot number and barcode
    const lotNumber = await generateLotNumber(material.part_number);
    const lotBarcode = generateLotBarcode(orgId, lotNumber);

    // Create the lot record
    const { data: lot, error: lotError } = await supabase
      .from("material_lots")
      .insert({
        org_id: orgId,
        material_id: materialId,
        lot_number: lotNumber,
        lot_barcode: lotBarcode,
        supplier_lot_number: lotInput.supplierLotNumber ?? null,
        initial_quantity: lotInput.quantity,
        current_quantity: lotInput.quantity,
        uom: material.base_uom,
        unit_type: lotInput.unitType ?? "box",
        units_per_package: lotInput.unitsPerPackage ?? null,
        supplier_id: lotInput.supplierId ?? null,
        location_id: locationId ?? lotInput.locationId ?? null,
        expiry_date: lotInput.expiryDate ?? null,
        manufactured_date: lotInput.manufacturedDate ?? null,
        cost_per_unit: lotInput.costPerUnit ?? null,
        notes: lotInput.notes ?? notes ?? null,
        quality_notes: lotInput.qualityNotes ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (lotError) {
      throw new Error(`Failed to create lot: ${lotError.message}`);
    }

    // Create receive transaction - must succeed for data integrity
    const { error: txnError } = await supabase
      .from("material_lot_transactions")
      .insert({
        org_id: orgId,
        lot_id: lot.id,
        material_id: materialId,
        transaction_type: "receive",
        quantity: lotInput.quantity,
        uom: material.base_uom,
        to_location_id: locationId ?? lotInput.locationId ?? null,
        quantity_after: lotInput.quantity,
        notes: `Received ${lotInput.quantity} ${material.base_uom}`,
        created_by: userId,
      });

    if (txnError) {
      // Rollback: delete the orphaned lot record
      await supabase.from("material_lots").delete().eq("id", lot.id);
      throw new Error(`Failed to create lot transaction: ${txnError.message}`);
    }

    // Also update aggregate material_stock - must succeed for data integrity
    const { error: stockError } = await supabase
      .from("material_transactions")
      .insert({
        org_id: orgId,
        material_id: materialId,
        transaction_type: "receive",
        quantity: lotInput.quantity,
        uom: material.base_uom,
        to_location_id: locationId ?? lotInput.locationId ?? null,
        lot_id: lot.id,
        notes: `Lot ${lotNumber} received`,
        created_by: userId,
      });

    if (stockError) {
      // Rollback: delete lot transaction and lot record
      await supabase.from("material_lot_transactions").delete().eq("lot_id", lot.id);
      await supabase.from("material_lots").delete().eq("id", lot.id);
      throw new Error(`Failed to update aggregate stock: ${stockError.message}`);
    }

    createdLots.push(mapMaterialLot(lot));
  }

  return createdLots;
}

// ============================================================================
// Lot Adjustment Operations
// ============================================================================

/**
 * Adjust lot quantity (positive or negative)
 */
export async function adjustLotQuantity(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  lotId: string,
  input: AdjustLotInput
): Promise<MaterialLot> {
  // Get current lot
  const lot = await getMaterialLot(supabase, orgId, lotId);
  if (!lot) {
    throw new Error("Lot not found");
  }

  const newQuantity = lot.currentQuantity + input.quantity;
  if (newQuantity < 0) {
    throw new Error("Cannot adjust below zero");
  }

  // Create adjustment transaction
  const { error: txnError } = await supabase
    .from("material_lot_transactions")
    .insert({
      org_id: orgId,
      lot_id: lotId,
      material_id: lot.materialId,
      transaction_type: "adjust",
      quantity: input.quantity,
      uom: lot.uom,
      from_location_id: lot.locationId,
      quantity_after: newQuantity,
      reference: input.reason,
      notes: input.notes,
      created_by: userId,
    });

  if (txnError) {
    throw new Error(`Failed to adjust lot: ${txnError.message}`);
  }

  // Also update aggregate stock
  await supabase.from("material_transactions").insert({
    org_id: orgId,
    material_id: lot.materialId,
    transaction_type: "adjust",
    quantity: input.quantity,
    uom: lot.uom,
    from_location_id: lot.locationId,
    lot_id: lotId,
    reference: input.reason,
    notes: `Lot ${lot.lotNumber}: ${input.notes ?? input.reason}`,
    created_by: userId,
  });

  // Fetch and return updated lot
  const updated = await getMaterialLot(supabase, orgId, lotId);
  if (!updated) {
    throw new Error("Failed to fetch updated lot");
  }

  return updated;
}

/**
 * Transfer lot to a new location
 */
export async function transferLot(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  lotId: string,
  input: TransferLotInput
): Promise<MaterialLot> {
  // Get current lot
  const lot = await getMaterialLot(supabase, orgId, lotId);
  if (!lot) {
    throw new Error("Lot not found");
  }

  if (lot.locationId === input.toLocationId) {
    throw new Error("Lot is already at this location");
  }

  // Update lot location
  const { error: updateError } = await supabase
    .from("material_lots")
    .update({
      location_id: input.toLocationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .eq("org_id", orgId);

  if (updateError) {
    throw new Error(`Failed to transfer lot: ${updateError.message}`);
  }

  // Create transfer transaction
  await supabase.from("material_lot_transactions").insert({
    org_id: orgId,
    lot_id: lotId,
    material_id: lot.materialId,
    transaction_type: "transfer",
    quantity: 0, // No quantity change
    uom: lot.uom,
    from_location_id: lot.locationId,
    to_location_id: input.toLocationId,
    quantity_after: lot.currentQuantity,
    notes: input.notes,
    created_by: userId,
  });

  // Fetch and return updated lot
  const updated = await getMaterialLot(supabase, orgId, lotId);
  if (!updated) {
    throw new Error("Failed to fetch updated lot");
  }

  return updated;
}

/**
 * Scrap a lot (mark as damaged and zero out quantity)
 */
export async function scrapLot(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  lotId: string,
  reason: string,
  notes?: string
): Promise<MaterialLot> {
  // Get current lot
  const lot = await getMaterialLot(supabase, orgId, lotId);
  if (!lot) {
    throw new Error("Lot not found");
  }

  if (lot.currentQuantity === 0) {
    throw new Error("Lot is already empty");
  }

  const quantityToScrap = -lot.currentQuantity;

  // Create scrap transaction (this will update lot via trigger)
  const { error: txnError } = await supabase
    .from("material_lot_transactions")
    .insert({
      org_id: orgId,
      lot_id: lotId,
      material_id: lot.materialId,
      transaction_type: "scrap",
      quantity: quantityToScrap,
      uom: lot.uom,
      from_location_id: lot.locationId,
      quantity_after: 0,
      reference: reason,
      notes: notes,
      created_by: userId,
    });

  if (txnError) {
    throw new Error(`Failed to scrap lot: ${txnError.message}`);
  }

  // Update lot status to damaged
  await supabase
    .from("material_lots")
    .update({
      status: "damaged",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lotId)
    .eq("org_id", orgId);

  // Also update aggregate stock
  await supabase.from("material_transactions").insert({
    org_id: orgId,
    material_id: lot.materialId,
    transaction_type: "scrap",
    quantity: quantityToScrap,
    uom: lot.uom,
    from_location_id: lot.locationId,
    lot_id: lotId,
    reference: reason,
    notes: `Lot ${lot.lotNumber} scrapped: ${notes ?? reason}`,
    created_by: userId,
  });

  // Fetch and return updated lot
  const updated = await getMaterialLot(supabase, orgId, lotId);
  if (!updated) {
    throw new Error("Failed to fetch updated lot");
  }

  return updated;
}

// ============================================================================
// Lot Consumption Operations
// ============================================================================

/**
 * Consume quantity from a specific lot for a batch
 */
export async function consumeFromLot(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  input: ConsumeLotInput
): Promise<{ lot: MaterialLot; consumed: number }> {
  // Get current lot
  const lot = await getMaterialLot(supabase, orgId, input.lotId);
  if (!lot) {
    throw new Error("Lot not found");
  }

  if (lot.status !== "available") {
    throw new Error(`Lot is ${lot.status}, cannot consume`);
  }

  if (lot.currentQuantity < input.quantity) {
    throw new Error(
      `Insufficient quantity in lot. Available: ${lot.currentQuantity}, Requested: ${input.quantity}`
    );
  }

  const newQuantity = lot.currentQuantity - input.quantity;

  // Create consume transaction
  const { error: txnError } = await supabase
    .from("material_lot_transactions")
    .insert({
      org_id: orgId,
      lot_id: input.lotId,
      material_id: lot.materialId,
      transaction_type: "consume",
      quantity: -input.quantity,
      uom: lot.uom,
      from_location_id: lot.locationId,
      batch_id: input.batchId,
      job_id: input.jobId ?? null,
      quantity_after: newQuantity,
      notes: input.notes,
      created_by: userId,
    });

  if (txnError) {
    throw new Error(`Failed to consume from lot: ${txnError.message}`);
  }

  // Create batch_material_lots record for traceability
  await supabase.from("batch_material_lots").insert({
    org_id: orgId,
    batch_id: input.batchId,
    lot_id: input.lotId,
    material_id: lot.materialId,
    quantity_consumed: input.quantity,
    uom: lot.uom,
    consumed_by: userId,
    job_id: input.jobId ?? null,
    notes: input.notes,
  });

  // Also update aggregate stock
  await supabase.from("material_transactions").insert({
    org_id: orgId,
    material_id: lot.materialId,
    transaction_type: "consume",
    quantity: -input.quantity,
    uom: lot.uom,
    from_location_id: lot.locationId,
    batch_id: input.batchId,
    lot_id: input.lotId,
    notes: `Consumed from lot ${lot.lotNumber}`,
    created_by: userId,
  });

  // Fetch and return updated lot
  const updated = await getMaterialLot(supabase, orgId, input.lotId);
  if (!updated) {
    throw new Error("Failed to fetch updated lot");
  }

  return { lot: updated, consumed: input.quantity };
}

// ============================================================================
// FIFO Selection
// ============================================================================

/**
 * Get available lots for a material in FIFO order
 */
export async function getAvailableLotsFifo(
  supabase: SupabaseClient,
  orgId: string,
  materialId: string,
  requiredQuantity?: number,
  locationId?: string
): Promise<FifoSelectionResult> {
  let query = supabase
    .from("material_lots")
    .select(
      `
      id,
      lot_number,
      lot_barcode,
      current_quantity,
      received_at,
      expiry_date,
      location_id,
      supplier_lot_number,
      location:nursery_locations(id, name)
    `
    )
    .eq("org_id", orgId)
    .eq("material_id", materialId)
    .eq("status", "available")
    .gt("current_quantity", 0);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  // Order by expiry (soon first), then by received date (FIFO)
  query = query
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get available lots: ${error.message}`);
  }

  const lots = data ?? [];
  let runningTotal = 0;
  const availableLots: AvailableLot[] = lots.map((row) => {
    const isSuggested =
      requiredQuantity === undefined || runningTotal < requiredQuantity;
    runningTotal += row.current_quantity;

    // Supabase returns joined data as arrays; extract first element if available
    const locationArray = row.location as { id: string; name: string }[] | null;
    const location = Array.isArray(locationArray) ? locationArray[0] ?? null : locationArray;

    return {
      lotId: row.id,
      lotNumber: row.lot_number,
      lotBarcode: row.lot_barcode,
      currentQuantity: row.current_quantity,
      receivedAt: row.received_at,
      expiryDate: row.expiry_date,
      locationId: row.location_id,
      locationName: location?.name ?? null,
      supplierLotNumber: row.supplier_lot_number,
      isSuggested,
    };
  });

  const totalAvailable = lots.reduce(
    (sum, lot) => sum + lot.current_quantity,
    0
  );

  return {
    lots: availableLots,
    totalAvailable,
    canFulfill: requiredQuantity === undefined || totalAvailable >= requiredQuantity,
    requiredQuantity: requiredQuantity ?? 0,
  };
}

// ============================================================================
// Lot Transaction History
// ============================================================================

/**
 * Get transaction history for a lot
 */
export async function getLotTransactions(
  supabase: SupabaseClient,
  orgId: string,
  lotId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ transactions: MaterialLotTransaction[]; total: number }> {
  const { data, error, count } = await supabase
    .from("material_lot_transactions")
    .select(
      `
      *,
      batch:batches(id, batch_number),
      job:production_jobs(id, name),
      from_location:nursery_locations!from_location_id(id, name),
      to_location:nursery_locations!to_location_id(id, name)
    `,
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .eq("lot_id", lotId)
    .order("created_at", { ascending: false })
    .range(
      options?.offset ?? 0,
      (options?.offset ?? 0) + (options?.limit ?? 50) - 1
    );

  if (error) {
    throw new Error(`Failed to get lot transactions: ${error.message}`);
  }

  return {
    transactions: (data ?? []).map(mapLotTransaction),
    total: count ?? 0,
  };
}

// ============================================================================
// Batch Material Traceability
// ============================================================================

/**
 * Get all lots consumed for a batch
 */
export async function getBatchMaterialLots(
  supabase: SupabaseClient,
  orgId: string,
  batchId: string
): Promise<BatchMaterialLot[]> {
  const { data, error } = await supabase
    .from("batch_material_lots")
    .select(
      `
      *,
      lot:material_lots(
        id,
        lot_number,
        lot_barcode,
        supplier_lot_number,
        supplier:suppliers(id, name),
        purchase_order_line:purchase_order_lines(
          id,
          purchase_order:purchase_orders(id, po_number)
        )
      ),
      material:materials(
        id,
        name,
        part_number,
        category:material_categories(id, name)
      ),
      job:production_jobs(id, name)
    `
    )
    .eq("org_id", orgId)
    .eq("batch_id", batchId)
    .order("consumed_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get batch material lots: ${error.message}`);
  }

  return (data ?? []).map(mapBatchMaterialLot);
}

// ============================================================================
// Mappers
// ============================================================================

function mapSortField(field: MaterialLotSortField): string {
  const map: Record<MaterialLotSortField, string> = {
    lotNumber: "lot_number",
    receivedAt: "received_at",
    currentQuantity: "current_quantity",
    expiryDate: "expiry_date",
    status: "status",
  };
  return map[field] ?? "received_at";
}

function mapMaterialLot(row: Record<string, unknown>): MaterialLot {
  const material = row.material as Record<string, unknown> | null;
  const supplier = row.supplier as Record<string, unknown> | null;
  const location = row.location as Record<string, unknown> | null;
  const poLine = row.purchase_order_line as Record<string, unknown> | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    materialId: row.material_id as string,
    material: material
      ? {
          id: material.id as string,
          orgId: material.org_id as string,
          partNumber: material.part_number as string,
          name: material.name as string,
          description: material.description as string | null,
          categoryId: material.category_id as string,
          category: material.category
            ? {
                id: (material.category as Record<string, unknown>).id as string,
                code: (material.category as Record<string, unknown>).code as MaterialCategoryCode,
                name: (material.category as Record<string, unknown>).name as string,
                parentGroup: (material.category as Record<string, unknown>)
                  .parent_group as MaterialParentGroup,
                consumptionType: (material.category as Record<string, unknown>)
                  .consumption_type as "per_unit" | "proportional" | "fixed",
                sortOrder: (material.category as Record<string, unknown>)
                  .sort_order as number,
                createdAt: (material.category as Record<string, unknown>)
                  .created_at as string,
              }
            : undefined,
          baseUom: material.base_uom as "each" | "litre" | "kg" | "ml" | "g",
          isActive: material.is_active as boolean,
          createdAt: material.created_at as string,
          updatedAt: material.updated_at as string,
        }
      : undefined,
    lotNumber: row.lot_number as string,
    lotBarcode: row.lot_barcode as string,
    supplierLotNumber: row.supplier_lot_number as string | null,
    initialQuantity: row.initial_quantity as number,
    currentQuantity: row.current_quantity as number,
    uom: row.uom as string,
    unitType: row.unit_type as MaterialLotUnitType,
    unitsPerPackage: row.units_per_package as number | null,
    supplierId: row.supplier_id as string | null,
    supplier: supplier
      ? { id: supplier.id as string, name: supplier.name as string }
      : null,
    purchaseOrderLineId: row.purchase_order_line_id as string | null,
    purchaseOrderLine: poLine
      ? {
          id: poLine.id as string,
          purchaseOrderId: poLine.purchase_order_id as string,
          purchaseOrder: poLine.purchase_order
            ? {
                id: (poLine.purchase_order as Record<string, unknown>)
                  .id as string,
                poNumber: (poLine.purchase_order as Record<string, unknown>)
                  .po_number as string,
              }
            : undefined,
        }
      : null,
    locationId: row.location_id as string | null,
    location: location
      ? { id: location.id as string, name: location.name as string }
      : null,
    receivedAt: row.received_at as string,
    expiryDate: row.expiry_date as string | null,
    manufacturedDate: row.manufactured_date as string | null,
    status: row.status as MaterialLotStatus,
    costPerUnit: row.cost_per_unit as number | null,
    notes: row.notes as string | null,
    qualityNotes: row.quality_notes as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapLotTransaction(row: Record<string, unknown>): MaterialLotTransaction {
  const batch = row.batch as Record<string, unknown> | null;
  const job = row.job as Record<string, unknown> | null;
  const fromLocation = row.from_location as Record<string, unknown> | null;
  const toLocation = row.to_location as Record<string, unknown> | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    lotId: row.lot_id as string,
    materialId: row.material_id as string,
    transactionType: row.transaction_type as MaterialLotTransaction["transactionType"],
    quantity: row.quantity as number,
    uom: row.uom as string,
    fromLocationId: row.from_location_id as string | null,
    fromLocation: fromLocation
      ? { id: fromLocation.id as string, name: fromLocation.name as string }
      : null,
    toLocationId: row.to_location_id as string | null,
    toLocation: toLocation
      ? { id: toLocation.id as string, name: toLocation.name as string }
      : null,
    batchId: row.batch_id as string | null,
    batch: batch
      ? { id: batch.id as string, batchNumber: batch.batch_number as string }
      : null,
    jobId: row.job_id as string | null,
    job: job ? { id: job.id as string, name: job.name as string } : null,
    quantityAfter: row.quantity_after as number,
    reference: row.reference as string | null,
    notes: row.notes as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}

function mapBatchMaterialLot(row: Record<string, unknown>): BatchMaterialLot {
  const lot = row.lot as Record<string, unknown> | null;
  const material = row.material as Record<string, unknown> | null;
  const job = row.job as Record<string, unknown> | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    batchId: row.batch_id as string,
    lotId: row.lot_id as string,
    lot: lot
      ? {
          id: lot.id as string,
          orgId: row.org_id as string,
          materialId: row.material_id as string,
          lotNumber: lot.lot_number as string,
          lotBarcode: lot.lot_barcode as string,
          supplierLotNumber: lot.supplier_lot_number as string | null,
          initialQuantity: 0,
          currentQuantity: 0,
          uom: row.uom as string,
          unitType: "box" as MaterialLotUnitType,
          status: "available" as MaterialLotStatus,
          receivedAt: "",
          createdAt: "",
          updatedAt: "",
        }
      : undefined,
    materialId: row.material_id as string,
    material: material
      ? {
          id: material.id as string,
          orgId: row.org_id as string,
          partNumber: material.part_number as string,
          name: material.name as string,
          categoryId: "",
          baseUom: "each" as const,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        }
      : undefined,
    quantityConsumed: row.quantity_consumed as number,
    uom: row.uom as string,
    consumedAt: row.consumed_at as string,
    consumedBy: row.consumed_by as string | null,
    jobId: row.job_id as string | null,
    job: job ? { id: job.id as string, name: job.name as string } : null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
  };
}
