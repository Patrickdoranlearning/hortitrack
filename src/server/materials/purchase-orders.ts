import { SupabaseClient } from "@supabase/supabase-js";
import { generatePONumber } from "@/server/numbering/materials";
import type {
  Material,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
} from "@/lib/types/materials";

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

  if (error) throw new Error(`Failed to fetch purchase orders: ${error.message}`);

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

export async function createPurchaseOrder(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrder> {
  // Generate PO number
  const poNumber = await generatePONumber();

  // Calculate totals
  let subtotal = 0;
  const linesWithTotals = input.lines.map((line, index) => {
    const discount = (line.unitPrice * line.quantityOrdered * (line.discountPct ?? 0)) / 100;
    const lineTotal = line.unitPrice * line.quantityOrdered - discount;
    subtotal += lineTotal;
    return {
      ...line,
      lineNumber: index + 1,
      lineTotal,
    };
  });

  // Insert PO
  const { data: poData, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      org_id: orgId,
      po_number: poNumber,
      supplier_id: input.supplierId,
      status: "draft",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: input.expectedDeliveryDate ?? null,
      delivery_location_id: input.deliveryLocationId ?? null,
      delivery_notes: input.deliveryNotes ?? null,
      supplier_ref: input.supplierRef ?? null,
      notes: input.notes ?? null,
      subtotal,
      tax_amount: 0,
      total_amount: subtotal,
      created_by: userId,
    })
    .select()
    .single();

  if (poError) throw new Error(`Failed to create purchase order: ${poError.message}`);

  // Insert lines
  const { error: linesError } = await supabase.from("purchase_order_lines").insert(
    linesWithTotals.map((line) => ({
      purchase_order_id: poData.id,
      material_id: line.materialId,
      line_number: line.lineNumber,
      quantity_ordered: line.quantityOrdered,
      quantity_received: 0,
      unit_price: line.unitPrice,
      discount_pct: line.discountPct ?? 0,
      line_total: line.lineTotal,
      notes: line.notes ?? null,
    }))
  );

  if (linesError) throw new Error(`Failed to create PO lines: ${linesError.message}`);

  // Return full PO
  return (await getPurchaseOrder(supabase, orgId, poData.id))!;
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
  // Check current status
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

  if (error) throw new Error(`Failed to update purchase order: ${error.message}`);

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

  if (error) throw new Error(`Failed to submit purchase order: ${error.message}`);

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

  if (error) throw new Error(`Failed to cancel purchase order: ${error.message}`);

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

export async function receiveGoods(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  poId: string,
  input: ReceiveGoodsInput
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(supabase, orgId, poId);
  if (!existing) throw new Error("Purchase order not found");
  if (existing.status === "cancelled" || existing.status === "received") {
    throw new Error("Cannot receive goods for cancelled or completed orders");
  }

  // Process each line
  for (const lineInput of input.lines) {
    if (lineInput.quantityReceived <= 0) continue;

    const line = existing.lines?.find((l) => l.id === lineInput.lineId);
    if (!line) throw new Error(`Line ${lineInput.lineId} not found`);

    const remainingQty = line.quantityOrdered - line.quantityReceived;
    if (lineInput.quantityReceived > remainingQty) {
      throw new Error(
        `Cannot receive ${lineInput.quantityReceived} for ${line.material?.partNumber}. Only ${remainingQty} remaining.`
      );
    }

    // Update line received quantity
    const { error: lineError } = await supabase
      .from("purchase_order_lines")
      .update({
        quantity_received: line.quantityReceived + lineInput.quantityReceived,
      })
      .eq("id", lineInput.lineId);

    if (lineError) throw new Error(`Failed to update line: ${lineError.message}`);

    // Create stock transaction (receive)
    const { error: txError } = await supabase.from("material_transactions").insert({
      org_id: orgId,
      material_id: line.materialId,
      transaction_type: "receive",
      quantity: lineInput.quantityReceived,
      uom: line.material?.baseUom ?? "each",
      to_location_id: input.locationId ?? null,
      purchase_order_line_id: lineInput.lineId,
      reference: existing.poNumber,
      notes: lineInput.notes ?? input.notes ?? null,
      created_by: userId,
    });

    if (txError) throw new Error(`Failed to create transaction: ${txError.message}`);
  }

  // Determine new status
  const updatedPO = await getPurchaseOrder(supabase, orgId, poId);
  if (!updatedPO) throw new Error("Failed to refresh PO");

  const allReceived = updatedPO.lines?.every(
    (l) => l.quantityReceived >= l.quantityOrdered
  );
  const someReceived = updatedPO.lines?.some((l) => l.quantityReceived > 0);

  let newStatus: PurchaseOrderStatus = updatedPO.status;
  if (allReceived) {
    newStatus = "received";
  } else if (someReceived) {
    newStatus = "partially_received";
  }

  if (newStatus !== updatedPO.status) {
    await supabase
      .from("purchase_orders")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
  }

  return (await getPurchaseOrder(supabase, orgId, poId))!;
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

  if (lineError) throw new Error(`Failed to add line: ${lineError.message}`);

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

  if (error) throw new Error(`Failed to remove line: ${error.message}`);

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
    // Only partial material data is loaded for display - cast to satisfy type
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
