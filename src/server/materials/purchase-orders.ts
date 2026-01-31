import { SupabaseClient } from "@supabase/supabase-js";
import { generatePONumber, generateLotNumber, generateLotBarcode } from "@/server/numbering/materials";
import type {
  Material,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
} from "@/lib/types/materials";
import type { MaterialLot } from "@/lib/types/material-lots";
import { logError } from "@/lib/log";

// ============================================================================
// Purchase Order Queries
// ============================================================================

export async function listPurchaseOrders(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ orders: PurchaseOrder[]; total: number }> {
  let query = supabase
    .from("purchase_orders")
    .select(
      `
      *,
      supplier:suppliers (id, name),
      delivery_location:nursery_locations (id, name),
      lines:purchase_order_lines (
        id,
        material_id,
        line_number,
        quantity_ordered,
        quantity_received,
        unit_price,
        discount_pct,
        line_total,
        material:materials (id, name, part_number)
      )
    `,
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.supplierId) {
    query = query.eq("supplier_id", options.supplierId);
  }

  if (options?.search) {
    query = query.or(
      `po_number.ilike.%${options.search}%,supplier_ref.ilike.%${options.search}%`
    );
  }

  query = query.range(
    options?.offset ?? 0,
    (options?.offset ?? 0) + (options?.limit ?? 50) - 1
  );

  const { data, error, count } = await query;

  if (error) {
    logError("Failed to fetch purchase orders", { error: error.message, orgId });
    throw new Error(`Failed to fetch purchase orders: ${error.message}`);
  }

  return {
    orders: (data ?? []).map(mapPurchaseOrder),
    total: count ?? 0,
  };
}

export async function getPurchaseOrder(
  supabase: SupabaseClient,
  orgId: string,
  id: string
): Promise<PurchaseOrder | null> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      *,
      supplier:suppliers (id, name),
      delivery_location:nursery_locations (id, name),
      lines:purchase_order_lines (
        id,
        material_id,
        line_number,
        quantity_ordered,
        quantity_received,
        unit_price,
        discount_pct,
        line_total,
        notes,
        material:materials (id, name, part_number, base_uom)
      )
    `
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    logError("Failed to fetch purchase order", { error: error.message, poId: id });
    throw new Error(`Failed to fetch purchase order: ${error.message}`);
  }

  return data ? mapPurchaseOrder(data) : null;
}

// ============================================================================
// Purchase Order CRUD
// ============================================================================

export type CreatePurchaseOrderInput = {
  supplierId: string;
  expectedDeliveryDate?: string | null;
  deliveryLocationId?: string | null;
  deliveryNotes?: string;
  supplierRef?: string;
  notes?: string;
  lines: {
    materialId: string;
    quantityOrdered: number;
    unitPrice: number;
    discountPct?: number;
    notes?: string;
  }[];
};

/**
 * Atomic PO creation via RPC
 */
export async function createPurchaseOrder(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrder> {
  const poNumber = await generatePONumber();

  const { data: rpcResult, error: rpcError } = await supabase.rpc('create_purchase_order', {
    p_org_id: orgId,
    p_user_id: userId,
    p_po_number: poNumber,
    p_supplier_id: input.supplierId,
    p_expected_delivery_date: input.expectedDeliveryDate || null,
    p_delivery_location_id: input.deliveryLocationId || null,
    p_delivery_notes: input.deliveryNotes || null,
    p_supplier_ref: input.supplierRef || null,
    p_notes: input.notes || null,
    p_lines: input.lines as any
  });

  if (rpcError) {
    logError("Failed to create purchase order via RPC", { error: rpcError.message, input });
    throw new Error(`Failed to create purchase order: ${rpcError.message}`);
  }

  const result = rpcResult as { success: boolean; po_id: string };
  return (await getPurchaseOrder(supabase, orgId, result.po_id))!;
}

export async function updatePurchaseOrder(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
  input: Partial<{
    supplierId: string;
    expectedDeliveryDate: string | null;
    deliveryLocationId: string | null;
    deliveryNotes: string;
    supplierRef: string;
    notes: string;
  }>
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(supabase, orgId, id);
  if (!existing) throw new Error("Purchase order not found");
  if (existing.status !== "draft") {
    throw new Error("Can only edit draft purchase orders");
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.supplierId !== undefined) updateData.supplier_id = input.supplierId;
  if (input.expectedDeliveryDate !== undefined)
    updateData.expected_delivery_date = input.expectedDeliveryDate;
  if (input.deliveryLocationId !== undefined)
    updateData.delivery_location_id = input.deliveryLocationId;
  if (input.deliveryNotes !== undefined) updateData.delivery_notes = input.deliveryNotes;
  if (input.supplierRef !== undefined) updateData.supplier_ref = input.supplierRef;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const { error } = await supabase
    .from("purchase_orders")
    .update(updateData)
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    logError("Failed to update purchase order", { error: error.message, poId: id });
    throw new Error(`Failed to update purchase order: ${error.message}`);
  }

  return (await getPurchaseOrder(supabase, orgId, id))!;
}

export async function submitPurchaseOrder(
  supabase: SupabaseClient,
  orgId: string,
  id: string
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(supabase, orgId, id);
  if (!existing) throw new Error("Purchase order not found");
  if (existing.status !== "draft") {
    throw new Error("Can only submit draft purchase orders");
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    logError("Failed to submit purchase order", { error: error.message, poId: id });
    throw new Error(`Failed to submit purchase order: ${error.message}`);
  }

  return (await getPurchaseOrder(supabase, orgId, id))!;
}

export async function cancelPurchaseOrder(
  supabase: SupabaseClient,
  orgId: string,
  id: string
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(supabase, orgId, id);
  if (!existing) throw new Error("Purchase order not found");
  if (existing.status === "received" || existing.status === "cancelled") {
    throw new Error("Cannot cancel a completed or already cancelled order");
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    logError("Failed to cancel purchase order", { error: error.message, poId: id });
    throw new Error(`Failed to cancel purchase order: ${error.message}`);
  }

  return (await getPurchaseOrder(supabase, orgId, id))!;
}

// ============================================================================
// Goods Receipt
// ============================================================================

export type ReceiveGoodsInput = {
  lines: {
    lineId: string;
    quantityReceived: number;
    notes?: string;
  }[];
  locationId?: string | null;
  notes?: string;
};

export type ReceiveGoodsWithLotsInput = {
  lines: {
    lineId: string;
    quantityReceived: number;
    lots: {
      quantity: number;
      unitType: 'box' | 'bag' | 'pallet' | 'roll' | 'bundle' | 'unit';
      unitsPerPackage?: number;
      supplierLotNumber?: string;
      expiryDate?: string;
      manufacturedDate?: string;
      notes?: string;
    }[];
    notes?: string;
  }[];
  locationId?: string | null;
  notes?: string;
};

/**
 * Atomic goods receipt via RPC
 */
export async function receiveGoods(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  poId: string,
  input: ReceiveGoodsInput
): Promise<PurchaseOrder> {
  const { data: rpcResult, error: rpcError } = await supabase.rpc('receive_goods_atomic', {
    p_org_id: orgId,
    p_user_id: userId,
    p_po_id: poId,
    p_lines: input.lines as any,
    p_location_id: input.locationId || null,
    p_notes: input.notes || null
  });

  if (rpcError) {
    logError("Failed to receive goods via RPC", { error: rpcError.message, poId, input });
    throw new Error(`Failed to receive goods: ${rpcError.message}`);
  }

  const result = rpcResult as { success: boolean; po_id: string };
  return (await getPurchaseOrder(supabase, orgId, result.po_id))!;
}

/**
 * Receive goods with lot creation
 * Creates individual material lots for each received item
 */
export async function receiveGoodsWithLots(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  poId: string,
  input: ReceiveGoodsWithLotsInput
): Promise<{ order: PurchaseOrder; lots: MaterialLot[] }> {
  // First, get the PO and validate
  const po = await getPurchaseOrder(supabase, orgId, poId);
  if (!po) throw new Error("Purchase order not found");

  if (po.status === "received" || po.status === "cancelled") {
    throw new Error(`Cannot receive goods: order is ${po.status}`);
  }

  const createdLots: MaterialLot[] = [];

  // Process each line
  for (const lineInput of input.lines) {
    const line = po.lines?.find((l) => l.id === lineInput.lineId);
    if (!line) {
      throw new Error(`Line ${lineInput.lineId} not found`);
    }

    // Validate total lot quantity matches received quantity
    const totalLotQuantity = lineInput.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (totalLotQuantity !== lineInput.quantityReceived) {
      throw new Error(
        `Lot quantities (${totalLotQuantity}) must equal received quantity (${lineInput.quantityReceived}) for line ${line.lineNumber}`
      );
    }

    // Get material details
    const { data: material, error: matError } = await supabase
      .from("materials")
      .select("part_number, base_uom")
      .eq("id", line.materialId)
      .single();

    if (matError || !material) {
      throw new Error(`Material not found for line ${line.lineNumber}`);
    }

    // Create lots for this line
    for (const lotInput of lineInput.lots) {
      const lotNumber = await generateLotNumber(material.part_number);
      const lotBarcode = generateLotBarcode(orgId, lotNumber);

      // Create lot record
      const { data: lot, error: lotError } = await supabase
        .from("material_lots")
        .insert({
          org_id: orgId,
          material_id: line.materialId,
          lot_number: lotNumber,
          lot_barcode: lotBarcode,
          supplier_lot_number: lotInput.supplierLotNumber ?? null,
          initial_quantity: lotInput.quantity,
          current_quantity: lotInput.quantity,
          uom: material.base_uom,
          unit_type: lotInput.unitType ?? "box",
          units_per_package: lotInput.unitsPerPackage ?? null,
          supplier_id: po.supplierId,
          purchase_order_line_id: line.id,
          location_id: input.locationId ?? null,
          expiry_date: lotInput.expiryDate ?? null,
          manufactured_date: lotInput.manufacturedDate ?? null,
          notes: lotInput.notes ?? null,
          created_by: userId,
        })
        .select()
        .single();

      if (lotError) {
        throw new Error(`Failed to create lot: ${lotError.message}`);
      }

      // Create lot transaction
      await supabase.from("material_lot_transactions").insert({
        org_id: orgId,
        lot_id: lot.id,
        material_id: line.materialId,
        transaction_type: "receive",
        quantity: lotInput.quantity,
        uom: material.base_uom,
        to_location_id: input.locationId ?? null,
        purchase_order_line_id: line.id,
        quantity_after: lotInput.quantity,
        notes: `Received via PO ${po.poNumber}`,
        created_by: userId,
      });

      // Also update aggregate material_stock via material_transactions
      await supabase.from("material_transactions").insert({
        org_id: orgId,
        material_id: line.materialId,
        transaction_type: "receive",
        quantity: lotInput.quantity,
        uom: material.base_uom,
        to_location_id: input.locationId ?? null,
        purchase_order_line_id: line.id,
        lot_id: lot.id,
        notes: `Lot ${lotNumber} received via PO ${po.poNumber}`,
        created_by: userId,
      });

      createdLots.push({
        id: lot.id,
        orgId: lot.org_id,
        materialId: lot.material_id,
        lotNumber: lot.lot_number,
        lotBarcode: lot.lot_barcode,
        supplierLotNumber: lot.supplier_lot_number,
        initialQuantity: lot.initial_quantity,
        currentQuantity: lot.current_quantity,
        uom: lot.uom,
        unitType: lot.unit_type,
        unitsPerPackage: lot.units_per_package,
        supplierId: lot.supplier_id,
        purchaseOrderLineId: lot.purchase_order_line_id,
        locationId: lot.location_id,
        receivedAt: lot.received_at,
        expiryDate: lot.expiry_date,
        manufacturedDate: lot.manufactured_date,
        status: lot.status,
        costPerUnit: lot.cost_per_unit,
        notes: lot.notes,
        qualityNotes: lot.quality_notes,
        createdBy: lot.created_by,
        createdAt: lot.created_at,
        updatedAt: lot.updated_at,
      });
    }

    // Update line quantity_received
    const newReceived = (line.quantityReceived ?? 0) + lineInput.quantityReceived;
    await supabase
      .from("purchase_order_lines")
      .update({
        quantity_received: newReceived,
        updated_at: new Date().toISOString(),
      })
      .eq("id", line.id);
  }

  // Update PO status
  const allLines = po.lines ?? [];
  const anyPartiallyReceived = allLines.some((l) => {
    const lineInput = input.lines.find((il) => il.lineId === l.id);
    const newReceived = (l.quantityReceived ?? 0) + (lineInput?.quantityReceived ?? 0);
    return newReceived > 0 && newReceived < l.quantityOrdered;
  });

  const allFullyReceived = allLines.every((l) => {
    const lineInput = input.lines.find((il) => il.lineId === l.id);
    const newReceived = (l.quantityReceived ?? 0) + (lineInput?.quantityReceived ?? 0);
    return newReceived >= l.quantityOrdered;
  });

  let newStatus: PurchaseOrderStatus = po.status;
  if (allFullyReceived) {
    newStatus = "received";
  } else if (anyPartiallyReceived || input.lines.length > 0) {
    newStatus = "partially_received";
  }

  await supabase
    .from("purchase_orders")
    .update({
      status: newStatus,
      received_at: newStatus === "received" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  const updatedOrder = await getPurchaseOrder(supabase, orgId, poId);
  return { order: updatedOrder!, lots: createdLots };
}

// ============================================================================
// PO Line Management
// ============================================================================

export async function addPurchaseOrderLine(
  supabase: SupabaseClient,
  orgId: string,
  poId: string,
  input: {
    materialId: string;
    quantityOrdered: number;
    unitPrice: number;
    discountPct?: number;
    notes?: string;
  }
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(supabase, orgId, poId);
  if (!existing) throw new Error("Purchase order not found");
  if (existing.status !== "draft") {
    throw new Error("Can only add lines to draft purchase orders");
  }

  const nextLineNumber = (existing.lines?.length ?? 0) + 1;
  const discount = (input.unitPrice * input.quantityOrdered * (input.discountPct ?? 0)) / 100;
  const lineTotal = input.unitPrice * input.quantityOrdered - discount;

  const { error: lineError } = await supabase.from("purchase_order_lines").insert({
    purchase_order_id: poId,
    material_id: input.materialId,
    line_number: nextLineNumber,
    quantity_ordered: input.quantityOrdered,
    quantity_received: 0,
    unit_price: input.unitPrice,
    discount_pct: input.discountPct ?? 0,
    line_total: lineTotal,
    notes: input.notes ?? null,
  });

  if (lineError) {
    logError("Failed to add PO line", { error: lineError.message, poId });
    throw new Error(`Failed to add line: ${lineError.message}`);
  }

  // Update totals
  const newSubtotal = (existing.subtotal ?? 0) + lineTotal;
  await supabase
    .from("purchase_orders")
    .update({
      subtotal: newSubtotal,
      total_amount: newSubtotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  return (await getPurchaseOrder(supabase, orgId, poId))!;
}

export async function removePurchaseOrderLine(
  supabase: SupabaseClient,
  orgId: string,
  poId: string,
  lineId: string
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(supabase, orgId, poId);
  if (!existing) throw new Error("Purchase order not found");
  if (existing.status !== "draft") {
    throw new Error("Can only remove lines from draft purchase orders");
  }

  const line = existing.lines?.find((l) => l.id === lineId);
  if (!line) throw new Error("Line not found");

  const { error } = await supabase.from("purchase_order_lines").delete().eq("id", lineId);

  if (error) {
    logError("Failed to remove PO line", { error: error.message, lineId });
    throw new Error(`Failed to remove line: ${error.message}`);
  }

  // Update totals
  const newSubtotal = (existing.subtotal ?? 0) - (line.lineTotal ?? 0);
  await supabase
    .from("purchase_orders")
    .update({
      subtotal: newSubtotal,
      total_amount: newSubtotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  return (await getPurchaseOrder(supabase, orgId, poId))!;
}

// ============================================================================
// Mappers
// ============================================================================

function mapPurchaseOrder(row: Record<string, unknown>): PurchaseOrder {
  const supplier = row.supplier as Record<string, unknown> | null;
  const deliveryLocation = row.delivery_location as Record<string, unknown> | null;
  const lines = row.lines as Record<string, unknown>[] | null;

  return {
    id: row.id as string,
    orgId: row.org_id as string,
    poNumber: row.po_number as string,
    supplierId: row.supplier_id as string,
    supplier: supplier
      ? { id: supplier.id as string, name: supplier.name as string }
      : undefined,
    status: row.status as PurchaseOrderStatus,
    orderDate: row.order_date as string,
    expectedDeliveryDate: row.expected_delivery_date as string | null,
    deliveryLocationId: row.delivery_location_id as string | null,
    deliveryLocation: deliveryLocation
      ? { id: deliveryLocation.id as string, name: deliveryLocation.name as string }
      : null,
    deliveryNotes: row.delivery_notes as string | null,
    supplierRef: row.supplier_ref as string | null,
    notes: row.notes as string | null,
    subtotal: Number(row.subtotal) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    lines: lines?.map(mapPurchaseOrderLine) ?? [],
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPurchaseOrderLine(row: Record<string, unknown>): PurchaseOrderLine {
  const material = row.material as Record<string, unknown> | null;

  return {
    id: row.id as string,
    purchaseOrderId: row.purchase_order_id as string,
    materialId: row.material_id as string,
    material: material
      ? ({
          id: material.id as string,
          name: material.name as string,
          partNumber: material.part_number as string,
          baseUom: material.base_uom as string | undefined,
        } as Material)
      : undefined,
    lineNumber: row.line_number as number,
    quantityOrdered: Number(row.quantity_ordered) || 0,
    quantityReceived: Number(row.quantity_received) || 0,
    uom: (material?.base_uom as string) ?? "each",
    unitPrice: Number(row.unit_price) || 0,
    discountPct: Number(row.discount_pct) || 0,
    lineTotal: Number(row.line_total) || 0,
    notes: row.notes as string | null,
    createdAt: row.created_at as string ?? new Date().toISOString(),
    updatedAt: row.updated_at as string ?? new Date().toISOString(),
  };
}
