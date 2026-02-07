'use server';

import { getSupabaseAdmin } from "@/server/db/supabase";
import { isValidDocId } from "@/server/utils/ids";
import type { StockMovement, StockMovementDestination } from "@/lib/history-types";
import { isInEvent, isOutEvent } from "@/lib/history-types";

type AnyDate = Date | string | number | null | undefined;

const toDate = (value: AnyDate) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
};

function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getString(payload: Record<string, unknown> | null, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function getNumber(payload: Record<string, unknown> | null, key: string): number | null {
  const value = payload?.[key];
  return typeof value === "number" ? value : null;
}

// Stock-related event types
const STOCK_EVENT_TYPES = new Set([
  'CHECKIN', 'CHECK_IN', 'CREATE', 'TRANSPLANT_IN', 'TRANSPLANT_FROM', 'PROPAGATION_IN',
  'MOVE_IN', 'PROPAGATE', 'STOCK_RECEIVED', 'BATCH_ACTUALIZED', 'ACTUALIZED',
  'TRANSPLANT_OUT', 'TRANSPLANT_TO', 'MOVE', 'CONSUMED',
  'PICKED', 'SALE', 'DISPATCH', 'LOSS', 'DUMP', 'ADJUSTMENT'
]);

// Creation-type IN events that duplicate initial_quantity when it's already set
const CREATION_EVENT_TYPES = new Set([
  'CREATE', 'MOVE_IN', 'PROPAGATE', 'CHECK_IN', 'CHECKIN', 'STOCK_RECEIVED', 'BATCH_ACTUALIZED', 'ACTUALIZED'
]);

/**
 * Build stock movement history for a batch - shows all IN/OUT movements with destination details
 */
export async function buildStockMovements(batchId: string): Promise<StockMovement[]> {
  if (!isValidDocId(batchId)) {
    throw new Error("Invalid batch ID provided.");
  }

  const supabase = getSupabaseAdmin();

  // Fetch batch info for initial quantity
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, initial_quantity, created_at")
    .eq("id", batchId)
    .single();

  if (batchError) throw new Error(batchError.message);

  // Fetch batch events filtered to stock-related types
  const { data: events, error: eventsError } = await supabase
    .from("batch_events")
    .select(`
      id,
      type,
      at,
      by_user_id,
      payload
    `)
    .eq("batch_id", batchId)
    .order("at", { ascending: true });

  if (eventsError) throw new Error(eventsError.message);

  // Fetch batch allocations with order details for destination info
  // Use left joins (no !inner) to handle orphaned allocations gracefully
  const { data: allocations, error: allocError } = await supabase
    .from("batch_allocations")
    .select(`
      id,
      quantity,
      status,
      created_at,
      order_items(
        id,
        orders(
          id,
          order_number,
          customers(name)
        )
      )
    `)
    .eq("batch_id", batchId);

  if (allocError) throw new Error(allocError.message);

  // Build allocation lookup for picked events
  const allocationLookup = new Map<string, {
    orderId: string;
    orderNumber: string;
    customerName: string;
  }>();

  for (const alloc of allocations || []) {
    const orderItem = alloc.order_items as any;
    const order = orderItem?.orders;
    if (order) {
      allocationLookup.set(alloc.id, {
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customers?.name || 'Unknown Customer'
      });
    }
  }

  // Fetch child batches for transplant destinations
  const { data: childBatches, error: childError } = await supabase
    .from("batches")
    .select("id, batch_number")
    .eq("parent_batch_id", batchId);

  if (childError) throw new Error(childError.message);

  const childBatchLookup = new Map<string, string>();
  for (const child of childBatches || []) {
    childBatchLookup.set(child.id, child.batch_number);
  }

  const movements: StockMovement[] = [];
  let runningBalance = 0;

  // Add initial quantity as first entry if the batch has one
  const initialQty = batch?.initial_quantity ?? 0;
  if (initialQty > 0) {
    runningBalance = initialQty;
    movements.push({
      id: `initial-${batchId}`,
      batchId,
      at: batch?.created_at ?? new Date().toISOString(),
      type: 'initial',
      quantity: initialQty,
      runningBalance: initialQty,
      title: `Initial stock: ${initialQty.toLocaleString()} units`,
      details: null,
      destination: undefined,
      userId: null,
      userName: null
    });
  }

  for (const evt of events || []) {
    const upperType = (evt.type ?? "").toUpperCase();

    // Only process stock-related events
    if (!STOCK_EVENT_TYPES.has(upperType)) continue;

    const payload = parsePayload(evt.payload);
    const eventType = evt.type?.toLowerCase() ?? 'event';

    // Extract quantity from payload
    let quantity: number | null = null;
    const rawQty = getNumber(payload, 'qty') ??
      getNumber(payload, 'quantity') ??
      getNumber(payload, 'units_picked') ??
      getNumber(payload, 'units') ??
      getNumber(payload, 'units_dumped') ??  // Legacy dump events use units_dumped
      getNumber(payload, 'units_moved') ??
      getNumber(payload, 'units_received') ??
      getNumber(payload, 'computed_units') ??
      getNumber(payload, 'consumedQuantity') ??  // CONSUMED events (transplant actualization)
      getNumber(payload, 'actualQuantity') ??    // ACTUALIZED events (planned batch actualized)
      getNumber(payload, 'diff');

    if (rawQty !== null) {
      // Determine sign based on event type
      if (isOutEvent(eventType)) {
        quantity = -Math.abs(rawQty);
      } else if (isInEvent(eventType)) {
        quantity = Math.abs(rawQty);
      } else {
        quantity = rawQty;
      }
    }

    // Skip if no quantity change
    if (quantity === null || quantity === 0) continue;

    // Skip creation-type events if we already added initial stock (to avoid double-counting)
    // These events represent the batch's initial stocking which is already captured by initial_quantity
    if (CREATION_EVENT_TYPES.has(upperType) && initialQty > 0) {
      continue;
    }

    // Skip full MOVE events (location change only, no stock impact)
    // Only partial moves (splits) actually change stock
    if (upperType === 'MOVE') {
      const isPartial = payload?.partial === true;
      const hasSplitBatch = getString(payload, 'split_batch_id') !== null;
      if (!isPartial && !hasSplitBatch) {
        continue;
      }
    }

    // Update running balance
    runningBalance += quantity;

    // Build title and destination based on event type
    let title = '';
    let destination: StockMovementDestination | undefined;

    switch (upperType) {
      case 'CHECKIN':
      case 'CHECK_IN':
        title = `Checked in ${Math.abs(quantity)} units`;
        const supplier = getString(payload, 'supplier') ?? getString(payload, 'supplier_name');
        if (supplier) {
          destination = { type: 'supplier', supplierName: supplier };
          title += ` from ${supplier}`;
        }
        break;

      case 'CREATE':
      case 'PROPAGATE':
      case 'STOCK_RECEIVED':
      case 'BATCH_ACTUALIZED':
      case 'ACTUALIZED':
        title = `Batch created with ${Math.abs(quantity)} units`;
        break;

      case 'TRANSPLANT_IN':
      case 'TRANSPLANT_FROM':
      case 'PROPAGATION_IN':
      case 'MOVE_IN': {
        const fromBatchNumber = getString(payload, 'from_batch_number');
        const fromBatchId = getString(payload, 'from_batch_id');
        title = `${Math.abs(quantity)} units ${upperType === 'MOVE_IN' ? 'moved' : 'transplanted'} in`;
        if (fromBatchNumber) {
          title += ` from batch ${fromBatchNumber}`;
          destination = {
            type: 'batch',
            batchId: fromBatchId ?? undefined,
            batchNumber: fromBatchNumber
          };
        }
        break;
      }

      case 'TRANSPLANT_OUT':
      case 'TRANSPLANT_TO':
        const toBatchNumber = getString(payload, 'to_batch_number');
        const toBatchId = getString(payload, 'to_batch_id');
        title = `${Math.abs(quantity)} units transplanted out`;
        if (toBatchNumber) {
          title += ` to batch ${toBatchNumber}`;
          destination = {
            type: 'batch',
            batchId: toBatchId ?? undefined,
            batchNumber: toBatchNumber
          };
        } else if (toBatchId && childBatchLookup.has(toBatchId)) {
          const childNumber = childBatchLookup.get(toBatchId);
          title += ` to batch ${childNumber}`;
          destination = {
            type: 'batch',
            batchId: toBatchId,
            batchNumber: childNumber
          };
        }
        break;

      case 'MOVE': {
        const splitBatchNumber = getString(payload, 'split_batch_number');
        const splitBatchId = getString(payload, 'split_batch_id');
        const toLocationName = getString(payload, 'to_location_name');
        title = `${Math.abs(quantity)} units moved out`;
        if (splitBatchNumber) {
          title += ` to batch ${splitBatchNumber}`;
          destination = {
            type: 'batch',
            batchId: splitBatchId ?? undefined,
            batchNumber: splitBatchNumber
          };
        } else if (toLocationName) {
          title += ` to ${toLocationName}`;
        }
        break;
      }

      case 'PICKED':
      case 'SALE':
      case 'DISPATCH':
        title = `${Math.abs(quantity)} units sold`;
        // Try to get order info from payload or allocation lookup
        const pickItemId = getString(payload, 'pick_item_id');
        const orderId = getString(payload, 'order_id');
        const orderNumber = getString(payload, 'order_number');
        const customerName = getString(payload, 'customer_name');

        if (orderNumber && customerName) {
          title += ` - Order #${orderNumber} (${customerName})`;
          destination = {
            type: 'order',
            orderId: orderId ?? undefined,
            orderNumber,
            customerName
          };
        } else if (pickItemId) {
          // Look up from allocations if we have the pick item ID
          const notes = getString(payload, 'notes');
          if (notes) title += ` - ${notes}`;
        }
        break;

      case 'CONSUMED': {
        const consumedByBatchId = getString(payload, 'consumedByBatch');
        title = `${Math.abs(quantity)} units consumed (transplant actualized)`;
        if (consumedByBatchId && childBatchLookup.has(consumedByBatchId)) {
          const childNumber = childBatchLookup.get(consumedByBatchId);
          title = `${Math.abs(quantity)} units transplanted to batch ${childNumber}`;
          destination = {
            type: 'batch',
            batchId: consumedByBatchId,
            batchNumber: childNumber
          };
        } else if (consumedByBatchId) {
          destination = {
            type: 'batch',
            batchId: consumedByBatchId
          };
        }
        break;
      }

      case 'LOSS':
      case 'DUMP':
        const lossReason = getString(payload, 'reason') ?? 'Unknown';
        title = `${Math.abs(quantity)} units lost: ${lossReason}`;
        destination = {
          type: 'loss',
          lossReason: lossReason
        };
        break;

      case 'ADJUSTMENT':
        const adjReason = getString(payload, 'reason') ?? getString(payload, 'notes');
        title = `Adjustment: ${quantity > 0 ? '+' : ''}${quantity} units`;
        if (adjReason) {
          title += ` - ${adjReason}`;
          destination = {
            type: 'adjustment',
            lossReason: adjReason
          };
        }
        break;

      default:
        title = `${quantity > 0 ? '+' : ''}${quantity} units (${eventType})`;
    }

    movements.push({
      id: evt.id,
      batchId,
      at: toDate(evt.at)?.toISOString() ?? new Date().toISOString(),
      type: eventType as any,
      quantity,
      runningBalance,
      title,
      details: getString(payload, 'notes') ?? getString(payload, 'details'),
      destination,
      userId: evt.by_user_id ?? null,
      userName: getString(payload, 'by_user')
    });
  }

  // Track which order_item_ids already have PICKED events to avoid duplicates
  const pickedOrderItemIds = new Set<string>();
  for (const evt of events || []) {
    const upperType = (evt.type ?? "").toUpperCase();
    if (upperType === 'PICKED' || upperType === 'SALE' || upperType === 'DISPATCH') {
      const payload = parsePayload(evt.payload);
      const orderItemId = getString(payload, 'order_item_id');
      if (orderItemId) pickedOrderItemIds.add(orderItemId);
    }
  }

  // Add allocations as entries
  // - 'allocated' status: Show as reserved (informational, doesn't affect balance)
  // - 'picked' status: Show as sold if no corresponding PICKED event exists
  for (const alloc of allocations || []) {
    const orderItem = alloc.order_items as any;
    const order = orderItem?.orders;
    if (!order) continue;

    const orderNumber = order.order_number;
    const customerName = order.customers?.name || 'Unknown Customer';
    const qty = alloc.quantity ?? 0;

    if (qty <= 0) continue;

    if (alloc.status === 'allocated') {
      // Show as reserved stock (informational entry)
      movements.push({
        id: `alloc-${alloc.id}`,
        batchId,
        at: alloc.created_at ?? new Date().toISOString(),
        type: 'allocated',
        quantity: -qty, // Show as pending outgoing (negative) for visibility in ledger
        runningBalance: undefined, // Don't affect running balance for reservations
        title: `${qty.toLocaleString()} units reserved`,
        details: `Order #${orderNumber} - ${customerName}`,
        destination: {
          type: 'order',
          orderId: order.id,
          orderNumber,
          customerName
        },
        userId: null,
        userName: null
      });
    } else if (alloc.status === 'picked') {
      // Check if we already have a PICKED event for this order item
      const orderItemId = orderItem?.id;
      if (orderItemId && pickedOrderItemIds.has(orderItemId)) {
        // Already captured via batch_events, skip to avoid duplicates
        continue;
      }

      // Add as sold entry (this handles historical picked allocations without events)
      runningBalance -= qty;
      movements.push({
        id: `sold-${alloc.id}`,
        batchId,
        at: alloc.created_at ?? new Date().toISOString(),
        type: 'picked',
        quantity: -qty,
        runningBalance,
        title: `${qty.toLocaleString()} units sold`,
        details: `Order #${orderNumber} - ${customerName}`,
        destination: {
          type: 'order',
          orderId: order.id,
          orderNumber,
          customerName
        },
        userId: null,
        userName: null
      });
    }
  }

  // Sort all movements by date
  movements.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return movements;
}

/**
 * Get stock movements with enriched order/batch details for destination tracking
 */
export async function getStockMovementsWithDetails(batchId: string) {
  const movements = await buildStockMovements(batchId);

  // Calculate summary
  const summary = {
    totalIn: 0,
    totalOut: 0,
    currentBalance: 0,
    soldToOrders: 0,
    transplantedOut: 0,
    losses: 0,
    allocated: 0  // Track reserved but not yet picked
  };

  for (const m of movements) {
    // Skip allocated entries from totalIn/totalOut - they're reservations, not actual movements
    if (m.type === 'allocated') {
      summary.allocated += Math.abs(m.quantity);
      continue;
    }

    if (m.quantity > 0) {
      summary.totalIn += m.quantity;
    } else {
      summary.totalOut += Math.abs(m.quantity);

      if (m.destination?.type === 'order') {
        summary.soldToOrders += Math.abs(m.quantity);
      } else if (m.destination?.type === 'batch') {
        summary.transplantedOut += Math.abs(m.quantity);
      } else if (m.destination?.type === 'loss') {
        summary.losses += Math.abs(m.quantity);
      }
    }
  }

  summary.currentBalance = summary.totalIn - summary.totalOut;

  return {
    movements,
    summary
  };
}
