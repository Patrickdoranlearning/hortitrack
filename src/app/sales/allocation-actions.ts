'use server';

/**
 * Two-Tier Stock Allocation Server Actions
 *
 * These actions implement the new two-tier allocation system:
 * - Tier 1 (Product): Reserve at product level when order confirmed (batch_id NULL)
 * - Tier 2 (Batch): Assign specific batches when picking starts
 *
 * Usage:
 * - confirmOrderWithAllocations: Confirms a draft order and creates Tier 1 allocations
 * - startPickingOrder: Transitions order to picking, returns items needing batch selection
 * - selectBatchForAllocation: Picker selects a batch for an allocation (Tier 1 -> Tier 2)
 * - getAvailableBatches: Returns available batches for a product (picker's batch list)
 * - getProductStockStatus: Returns product ATS and stock status
 * - cancelAllocation: Releases an allocation
 */

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logError, logInfo } from '@/lib/log';

// ---- RPC result shapes ----

/** Shape returned by fn_confirm_order_with_allocations */
interface ConfirmOrderRpcResult {
  success: boolean;
  error?: string;
  has_oversell_warning?: boolean;
  oversell_items?: Array<{
    orderItemId: string;
    productId: string;
    quantity: number;
    warning: string;
  }>;
}

/** Shape returned by fn_start_picking_order */
interface StartPickingRpcResult {
  success: boolean;
  error?: string;
  pending_batch_selections?: PendingBatchSelection[];
}

/** Shape returned by fn_transition_to_batch_allocation */
interface TransitionAllocationRpcResult {
  success: boolean;
  error?: string;
  allocation_id?: string;
  quantity?: number;
}

/** Shape returned by fn_mark_allocation_picked */
interface MarkPickedRpcResult {
  success: boolean;
  error?: string;
  picked_quantity?: number;
  shortage?: number;
}

/** Shape returned by fn_cancel_allocation */
interface CancelAllocationRpcResult {
  success: boolean;
  error?: string;
  quantity_released?: number;
}

/** Shape returned by fn_get_allocation_candidates RPC */
interface AllocationCandidateRow {
  batch_id: string;
  batch_number: string;
  variety_name: string;
  variety_id: string;
  available_quantity: number;
  location_id: string | null;
  location_name: string | null;
  growing_status: string | null;
  sales_status: string | null;
  age_weeks: number;
  planted_at: string | null;
}

/** Shape of allocation_ledger rows with joins */
interface AllocationLedgerRow {
  id: string;
  order_item_id: string;
  product_id: string;
  batch_id: string | null;
  allocation_tier: string;
  allocation_status: string;
  quantity: number;
  picked_quantity: number;
  reserved_at: string;
  allocated_at: string | null;
  picked_at: string | null;
  products: { name: string } | null;
  batches: {
    batch_number: string;
    plant_varieties: { name: string } | null;
  } | null;
}

/** Shape of inventory_events rows */
interface InventoryEventRow {
  id: string;
  event_type: string;
  quantity_change: number;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
}

// Types for the two-tier allocation system
export type AllocationTier = 'product' | 'batch';
export type AllocationStatus = 'reserved' | 'allocated' | 'picked' | 'shipped' | 'cancelled';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface ProductATS {
  productId: string;
  calculatedAts: number;
  overrideAts: number | null;
  effectiveAts: number;
  tier1Reserved: number;
  stockStatus: StockStatus;
  lowStockThreshold: number;
  allowOversell: boolean;
}

export interface BatchCandidate {
  batchId: string;
  batchNumber: string;
  varietyName: string;
  varietyId: string;
  availableQuantity: number;
  locationId: string | null;
  locationName: string | null;
  growingStatus: string | null;
  salesStatus: string | null;
  ageWeeks: number;
  plantedAt: string | null;
}

export interface AllocationResult {
  success: boolean;
  error?: string;
  allocationId?: string;
  tier?: AllocationTier;
  status?: AllocationStatus;
  quantity?: number;
  isOversell?: boolean;
  warning?: string;
}

export interface PendingBatchSelection {
  allocationId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
}

// =============================================================================
// Product Stock Status
// =============================================================================

/**
 * Get the current Available-to-Sell (ATS) for a product
 */
export async function getProductStockStatus(productId: string): Promise<{
  data?: ProductATS;
  error?: string;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('fn_calculate_product_ats', { p_product_id: productId })
    .single();

  if (error) {
    logError('Error fetching product ATS', { error: error.message, productId });
    return { error: 'Failed to fetch product stock status' };
  }

  if (!data) {
    return { error: 'Product not found' };
  }

  return {
    data: {
      productId,
      calculatedAts: data.calculated_ats ?? 0,
      overrideAts: data.override_ats,
      effectiveAts: data.effective_ats ?? 0,
      tier1Reserved: data.tier1_reserved ?? 0,
      stockStatus: (data.stock_status as StockStatus) ?? 'out_of_stock',
      lowStockThreshold: 10, // Default, could be fetched from product
      allowOversell: true, // Default
    }
  };
}

/**
 * Get stock status for multiple products
 */
export async function getProductsStockStatus(productIds: string[]): Promise<{
  data?: Record<string, ProductATS>;
  error?: string;
}> {
  if (!productIds.length) {
    return { data: {} };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('v_product_inventory')
    .select('*')
    .in('product_id', productIds);

  if (error) {
    logError('Error fetching products ATS', { error: error.message });
    return { error: 'Failed to fetch product stock statuses' };
  }

  const result: Record<string, ProductATS> = {};
  for (const row of data || []) {
    result[row.product_id] = {
      productId: row.product_id,
      calculatedAts: row.calculated_stock ?? 0,
      overrideAts: row.ats_override,
      effectiveAts: row.effective_ats ?? 0,
      tier1Reserved: row.tier1_reserved ?? 0,
      stockStatus: (row.stock_status as StockStatus) ?? 'out_of_stock',
      lowStockThreshold: row.low_stock_threshold ?? 10,
      allowOversell: row.allow_oversell ?? true,
    };
  }

  return { data: result };
}

// =============================================================================
// Available Batches for Picking
// =============================================================================

/**
 * Get available batches for a product (for batch selection during picking)
 */
export async function getAvailableBatches(
  orgId: string,
  productId: string,
  filters?: {
    varietyFilter?: string;
    locationFilter?: string;
  }
): Promise<{
  data?: BatchCandidate[];
  error?: string;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('fn_get_allocation_candidates', {
    p_org_id: orgId,
    p_product_id: productId,
    p_variety_filter: filters?.varietyFilter || null,
    p_location_filter: filters?.locationFilter || null,
  });

  if (error) {
    logError('Error fetching allocation candidates', { error: error.message, productId });
    return { error: 'Failed to fetch available batches' };
  }

  return {
    data: ((data || []) as unknown as AllocationCandidateRow[]).map((row) => ({
      batchId: row.batch_id,
      batchNumber: row.batch_number,
      varietyName: row.variety_name,
      varietyId: row.variety_id,
      availableQuantity: row.available_quantity,
      locationId: row.location_id,
      locationName: row.location_name,
      growingStatus: row.growing_status,
      salesStatus: row.sales_status,
      ageWeeks: row.age_weeks,
      plantedAt: row.planted_at,
    }))
  };
}

// =============================================================================
// Order Confirmation with Tier 1 Allocations
// =============================================================================

/**
 * Confirm a draft order and create Tier 1 (product-level) allocations
 */
export async function confirmOrderWithAllocations(orderId: string): Promise<{
  success: boolean;
  error?: string;
  hasOversellWarning?: boolean;
  oversellItems?: Array<{
    orderItemId: string;
    productId: string;
    quantity: number;
    warning: string;
  }>;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('fn_confirm_order_with_allocations', {
    p_order_id: orderId,
    p_actor_id: user.id,
  });

  if (error) {
    logError('Error confirming order with allocations', { error: error.message, orderId });
    return { success: false, error: error.message };
  }

  const result = data as unknown as ConfirmOrderRpcResult | null;

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to confirm order' };
  }

  // Log the event
  const { data: order } = await supabase
    .from('orders')
    .select('org_id')
    .eq('id', orderId)
    .single();

  if (order) {
    await supabase.from('order_events').insert({
      org_id: order.org_id,
      order_id: orderId,
      event_type: 'order_confirmed',
      description: 'Order confirmed with Tier 1 (product-level) allocations',
      created_by: user.id,
    });
  }

  revalidatePath('/sales/orders');
  revalidatePath(`/sales/orders/${orderId}`);

  return {
    success: true,
    hasOversellWarning: result.has_oversell_warning || false,
    oversellItems: result.oversell_items || [],
  };
}

// =============================================================================
// Start Picking (Transition to Tier 2)
// =============================================================================

/**
 * Start picking an order - transitions to picking status and returns
 * items needing batch selection
 */
export async function startPickingOrder(orderId: string): Promise<{
  success: boolean;
  error?: string;
  pendingBatchSelections?: PendingBatchSelection[];
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('fn_start_picking_order', {
    p_order_id: orderId,
    p_actor_id: user.id,
  });

  if (error) {
    logError('Error starting picking', { error: error.message, orderId });
    return { success: false, error: error.message };
  }

  const result = data as unknown as StartPickingRpcResult | null;

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to start picking' };
  }

  // Log the event
  const { data: order } = await supabase
    .from('orders')
    .select('org_id')
    .eq('id', orderId)
    .single();

  if (order) {
    await supabase.from('order_events').insert({
      org_id: order.org_id,
      order_id: orderId,
      event_type: 'picking_started',
      description: 'Picking started - batch selection required',
      created_by: user.id,
    });
  }

  revalidatePath('/sales/orders');
  revalidatePath('/sales/picking');
  revalidatePath(`/sales/orders/${orderId}`);

  return {
    success: true,
    pendingBatchSelections: result.pending_batch_selections || [],
  };
}

// =============================================================================
// Batch Selection (Tier 1 -> Tier 2)
// =============================================================================

/**
 * Select a batch for an allocation (upgrades Tier 1 to Tier 2)
 */
export async function selectBatchForAllocation(
  allocationId: string,
  batchId: string
): Promise<AllocationResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('fn_transition_to_batch_allocation', {
    p_allocation_id: allocationId,
    p_batch_id: batchId,
    p_actor_id: user.id,
  });

  if (error) {
    logError('Error selecting batch', { error: error.message, allocationId, batchId });
    return { success: false, error: error.message };
  }

  const result = data as unknown as TransitionAllocationRpcResult | null;

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to select batch' };
  }

  revalidatePath('/sales/picking');

  return {
    success: true,
    allocationId: result.allocation_id,
    tier: 'batch',
    status: 'allocated',
    quantity: result.quantity,
  };
}

// =============================================================================
// Mark Allocation as Picked
// =============================================================================

/**
 * Mark an allocation as picked (after batch is selected and items physically picked)
 */
export async function markAllocationPicked(
  allocationId: string,
  pickedQuantity?: number
): Promise<{
  success: boolean;
  error?: string;
  pickedQuantity?: number;
  shortage?: number;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('fn_mark_allocation_picked', {
    p_allocation_id: allocationId,
    p_picked_quantity: pickedQuantity || null,
    p_actor_id: user.id,
  });

  if (error) {
    logError('Error marking allocation picked', { error: error.message, allocationId });
    return { success: false, error: error.message };
  }

  const result = data as unknown as MarkPickedRpcResult | null;

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to mark as picked' };
  }

  revalidatePath('/sales/picking');

  return {
    success: true,
    pickedQuantity: result.picked_quantity,
    shortage: result.shortage,
  };
}

// =============================================================================
// Cancel Allocation
// =============================================================================

/**
 * Cancel an allocation and release the reserved stock
 */
export async function cancelAllocation(
  allocationId: string,
  reason?: string
): Promise<{
  success: boolean;
  error?: string;
  quantityReleased?: number;
}> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase.rpc('fn_cancel_allocation', {
    p_allocation_id: allocationId,
    p_reason: reason || null,
    p_actor_id: user.id,
  });

  if (error) {
    logError('Error cancelling allocation', { error: error.message, allocationId });
    return { success: false, error: error.message };
  }

  const result = data as unknown as CancelAllocationRpcResult | null;

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to cancel allocation' };
  }

  revalidatePath('/sales/orders');
  revalidatePath('/sales/picking');

  return {
    success: true,
    quantityReleased: result.quantity_released,
  };
}

// =============================================================================
// Get Allocations for Order
// =============================================================================

/**
 * Get all allocations for an order
 */
export async function getOrderAllocations(orderId: string): Promise<{
  data?: Array<{
    id: string;
    orderItemId: string;
    productId: string;
    batchId: string | null;
    tier: AllocationTier;
    status: AllocationStatus;
    quantity: number;
    pickedQuantity: number;
    reservedAt: string;
    allocatedAt: string | null;
    pickedAt: string | null;
    product?: {
      name: string;
    };
    batch?: {
      batchNumber: string;
      varietyName: string;
    };
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('allocation_ledger')
    .select(`
      id,
      order_item_id,
      product_id,
      batch_id,
      allocation_tier,
      allocation_status,
      quantity,
      picked_quantity,
      reserved_at,
      allocated_at,
      picked_at,
      products:product_id (name),
      batches:batch_id (
        batch_number,
        plant_varieties (name)
      )
    `)
    .in('order_item_id',
      supabase.from('order_items').select('id').eq('order_id', orderId)
    )
    .order('reserved_at', { ascending: true });

  if (error) {
    logError('Error fetching order allocations', { error: error.message, orderId });
    return { error: 'Failed to fetch allocations' };
  }

  return {
    data: ((data || []) as unknown as AllocationLedgerRow[]).map((row) => ({
      id: row.id,
      orderItemId: row.order_item_id,
      productId: row.product_id,
      batchId: row.batch_id,
      tier: row.allocation_tier as AllocationTier,
      status: row.allocation_status as AllocationStatus,
      quantity: row.quantity,
      pickedQuantity: row.picked_quantity,
      reservedAt: row.reserved_at,
      allocatedAt: row.allocated_at,
      pickedAt: row.picked_at,
      product: row.products ? { name: row.products.name } : undefined,
      batch: row.batches ? {
        batchNumber: row.batches.batch_number,
        varietyName: row.batches.plant_varieties?.name ?? '',
      } : undefined,
    }))
  };
}

// =============================================================================
// Get Allocation Events (Audit Trail)
// =============================================================================

/**
 * Get inventory events for an allocation or order
 */
export async function getAllocationEvents(
  options: { allocationId?: string; orderId?: string; orderItemId?: string }
): Promise<{
  data?: Array<{
    id: string;
    eventType: string;
    quantityChange: number;
    occurredAt: string;
    metadata: Record<string, unknown>;
    actorId: string | null;
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  let query = supabase
    .from('inventory_events')
    .select('*')
    .order('occurred_at', { ascending: false });

  if (options.allocationId) {
    query = query.eq('allocation_id', options.allocationId);
  } else if (options.orderId) {
    query = query.eq('order_id', options.orderId);
  } else if (options.orderItemId) {
    query = query.eq('order_item_id', options.orderItemId);
  } else {
    return { error: 'Must provide allocationId, orderId, or orderItemId' };
  }

  const { data, error } = await query;

  if (error) {
    logError('Error fetching allocation events', { error: error.message });
    return { error: 'Failed to fetch events' };
  }

  return {
    data: ((data || []) as unknown as InventoryEventRow[]).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      quantityChange: row.quantity_change,
      occurredAt: row.occurred_at,
      metadata: row.metadata || {},
      actorId: row.actor_id,
    }))
  };
}
