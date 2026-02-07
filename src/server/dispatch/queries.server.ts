import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Haulier, HaulierVehicle, HaulierWithVehicles } from "@/lib/types";
import { listAttributeOptions } from "@/server/attributeOptions/service";
import { getUserAndOrg } from "@/server/auth/org";
import type { AttributeOption } from "@/lib/attributeOptions";
import { logger, getErrorMessage } from "@/server/utils/logger";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import type {
  DeliveryRunRow,
  DeliveryRunUpdate,
  DeliveryItemRow,
  DeliveryItemUpdate,
  OrderPackingRow,
  OrderPackingUpdate,
  TrolleyRow,
  OrderStatusUpdateRow,
  HaulierRow,
  HaulierVehicleRow,
} from "@/lib/dispatch/db-types";
import type {
  DeliveryRun,
  DeliveryRunStatusType,
  DeliveryItem,
  OrderPacking,
  Trolley,
  TrolleyTransaction,
  CustomerTrolleyBalance,
  OrderStatusUpdate,
  CreateDeliveryRun,
  AddToDeliveryRun,
  UpdateDeliveryItem,
  UpdatePacking,
  CreateTrolley,
  CreateTrolleyTransaction,
  CreateOrderStatusUpdate,
  OrderReadyForDispatch,
  ActiveDeliveryRunSummary,
  CustomerTrolleySummary,
  DeliveryRunWithItems,
  DispatchOrder,
  DispatchBoardOrder,
  DispatchStage
} from "@/lib/dispatch/types";
import { generateId } from "@/server/utils/ids";

// ================================================
// DELIVERY RUNS
// ================================================

/**
 * List all delivery runs with optional filtering
 */
export async function listDeliveryRuns(
  filters?: {
    status?: string;
    runDate?: string;
    limit?: number;
  }
): Promise<DeliveryRun[]> {
  const { orgId, supabase } = await getUserAndOrg();

  let query = supabase
    .from("delivery_runs")
    .select("*")
    .eq("org_id", orgId)
    .order("run_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 100);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.runDate) {
    query = query.eq("run_date", filters.runDate);
  }

  const { data, error } = await query;
  if (error) {
    logger.dispatch.error("Error listing delivery runs", error);
    throw error;
  }

  return (data as DeliveryRunRow[]).map(mapDeliveryRunFromDb);
}

/**
 * Get active delivery runs with item counts and fill status
 * Optimized: Single query with JOINs instead of 4 separate queries
 */
export async function getActiveDeliveryRuns(options?: {
  statuses?: DeliveryRunStatusType[];
  runDateWindow?: { start: string; end: string };
}): Promise<ActiveDeliveryRunSummary[]> {
  const { orgId, supabase } = await getUserAndOrg();
  const statuses = options?.statuses?.length ? options.statuses : ["planned", "loading"];

  // Single query with all related data using Supabase's nested select
  let runsQuery = supabase
    .from("delivery_runs")
    .select(`
      *,
      hauliers(id, name, trolley_capacity),
      haulier_vehicles(id, name, trolley_capacity),
      delivery_items(
        id,
        order_id,
        orders(trolleys_estimated)
      )
    `)
    .eq("org_id", orgId)
    .in("status", statuses)
    .order("run_date", { ascending: true });

  if (options?.runDateWindow) {
    runsQuery = runsQuery
      .gte("run_date", options.runDateWindow.start)
      .lte("run_date", options.runDateWindow.end);
  }

  const { data: runsData, error: runsError } = await runsQuery;

  if (runsError) {
    logger.dispatch.error("Error fetching delivery runs", runsError);
    // Return empty array instead of throwing to allow page to load
    return [];
  }

  if (!runsData || runsData.length === 0) {
    return [];
  }

  // Type for the nested query result
  type RunWithRelations = DeliveryRunRow & {
    hauliers: HaulierRow | null;
    haulier_vehicles: HaulierVehicleRow | null;
    delivery_items: Array<{
      id: string;
      order_id: string;
      orders: { trolleys_estimated: number | null } | null;
    }>;
  };

  // Process data - all relationships are already loaded
  const processedRuns = (runsData as RunWithRelations[]).map((d) => {
    const haulier = d.hauliers;
    const vehicle = d.haulier_vehicles;
    const deliveryItems = Array.isArray(d.delivery_items) ? d.delivery_items : [];

    // Calculate trolley totals from nested delivery_items
    let totalTrolleys = 0;
    for (const item of deliveryItems) {
      totalTrolleys += item.orders?.trolleys_estimated || 0;
    }
    const orderCount = deliveryItems.length;

    return {
      ...d,
      haulier,
      vehicle,
      totals: { totalTrolleys, orderCount }
    };
  });

  // Sort by display_order (if available) then run_date
  const sortedRuns = [...processedRuns].sort((a, b) => {
    const orderA = a.display_order ?? 999;
    const orderB = b.display_order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.run_date || '').localeCompare(b.run_date || '');
  });

  return sortedRuns.map((d) => {
    const haulier = d.haulier;
    const vehicle = d.vehicle;
    // Use vehicle capacity if set, otherwise fall back to haulier capacity
    const vehicleCapacity = vehicle?.trolley_capacity ?? haulier?.trolley_capacity ?? 20;
    const totals = d.totals || { totalTrolleys: 0, orderCount: 0 };
    const fillPercentage = vehicleCapacity > 0
      ? Math.round((totals.totalTrolleys / vehicleCapacity) * 100)
      : 0;

    // Compute week number from run_date if not stored
    let weekNumber: number | undefined = d.week_number ?? undefined;
    if (!weekNumber && d.run_date) {
      try {
        const date = new Date(d.run_date);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      } catch {
        weekNumber = undefined;
      }
    }

    return {
      id: d.id,
      runNumber: d.run_number,
      loadCode: d.load_name ?? undefined,
      weekNumber,
      orgId: d.org_id,
      runDate: d.run_date,
      status: d.status,
      driverName: d.driver_name ?? undefined,
      vehicleRegistration: d.vehicle_registration ?? undefined,
      trolleysLoaded: d.trolleys_loaded || 0,
      trolleysReturned: d.trolleys_returned || 0,
      trolleysOutstanding: (d.trolleys_loaded || 0) - (d.trolleys_returned || 0),
      totalDeliveries: totals.orderCount,
      completedDeliveries: 0,
      pendingDeliveries: totals.orderCount,
      haulierId: d.haulier_id ?? undefined,
      haulierName: haulier?.name,
      vehicleId: d.vehicle_id ?? undefined,
      vehicleName: vehicle?.name,
      vehicleCapacity,
      displayOrder: d.display_order ?? 0,
      totalTrolleysAssigned: totals.totalTrolleys,
      fillPercentage,
    };
  });
}

/**
 * Get a single delivery run with all its items
 */
export async function getDeliveryRunWithItems(runId: string): Promise<DeliveryRunWithItems | null> {
  const { orgId, supabase } = await getUserAndOrg();

  // Get delivery run
  const { data: runData, error: runError } = await supabase
    .from("delivery_runs")
    .select("*")
    .eq("id", runId)
    .eq("org_id", orgId)
    .single();

  if (runError || !runData) {
    logger.dispatch.error("Error fetching delivery run", runError, { runId, orgId });
    return null;
  }

  // Get delivery items with order details
  const { data: itemsData, error: itemsError } = await supabase
    .from("delivery_items")
    .select(`
      *,
      orders (
        order_number,
        customer_id,
        status,
        total_inc_vat,
        requested_delivery_date,
        customers (name),
        customer_addresses!orders_ship_to_address_id_fkey (
          line1,
          line2,
          city,
          county,
          eircode
        )
      )
    `)
    .eq("delivery_run_id", runId)
    .order("sequence_number", { ascending: true });

  if (itemsError) {
    logger.dispatch.error("Error fetching delivery items", itemsError, { runId });
    throw itemsError;
  }

  // Type for the nested query result
  type DeliveryItemWithOrderJoin = DeliveryItemRow & {
    orders: {
      order_number: string;
      customer_id: string;
      status: string;
      total_inc_vat: number;
      requested_delivery_date: string | null;
      customers: { name: string } | null;
      customer_addresses: {
        line1: string;
        line2: string | null;
        city: string | null;
        county: string | null;
        eircode: string | null;
      } | null;
    } | null;
  };

  const items = ((itemsData || []) as DeliveryItemWithOrderJoin[]).map((item) => ({
    ...mapDeliveryItemFromDb(item),
    order: {
      orderNumber: item.orders?.order_number || "",
      customerId: item.orders?.customer_id || "",
      customerName: item.orders?.customers?.name || "Unknown",
      totalIncVat: item.orders?.total_inc_vat || 0,
      requestedDeliveryDate: item.orders?.requested_delivery_date ?? undefined,
      orderStatus: item.orders?.status,
      shipToAddress: item.orders?.customer_addresses
        ? {
            line1: item.orders.customer_addresses.line1,
            line2: item.orders.customer_addresses.line2 ?? undefined,
            city: item.orders.customer_addresses.city ?? undefined,
            county: item.orders.customer_addresses.county ?? undefined,
            eircode: item.orders.customer_addresses.eircode ?? undefined,
          }
        : undefined,
    },
  }));

  return {
    ...mapDeliveryRunFromDb(runData),
    items,
  };
}

/**
 * Create a new delivery run
 */
export async function createDeliveryRun(input: CreateDeliveryRun): Promise<string> {
  const { user, orgId, supabase } = await getUserAndOrg();

  // Generate run number with retry to handle race conditions
  // Unique constraint (org_id, run_number) prevents duplicates
  const datePart = input.runDate.replace(/-/g, "");
  const maxRetries = 3;
  let data: { id: string } | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: existingRuns } = await supabase
      .from("delivery_runs")
      .select("run_number")
      .eq("org_id", orgId)
      .like("run_number", `DR-${datePart}-%`)
      .order("run_number", { ascending: false })
      .limit(1);

    let sequence = 1;
    if (existingRuns && existingRuns.length > 0) {
      const lastNumber = existingRuns[0].run_number;
      const lastSequence = parseInt(lastNumber.split("-").pop() || "0");
      sequence = lastSequence + 1;
    }
    const runNumber = `DR-${datePart}-${sequence.toString().padStart(3, "0")}`;

    const { data: insertData, error } = await supabase
      .from("delivery_runs")
      .insert({
        id: generateId(),
        org_id: orgId,
        run_number: runNumber,
        run_date: input.runDate,
        load_name: input.loadCode,
        haulier_id: input.haulierId,
        vehicle_id: input.vehicleId,
        driver_name: input.driverName,
        vehicle_registration: input.vehicleRegistration,
        vehicle_type: input.vehicleType,
        planned_departure_time: input.plannedDepartureTime,
        estimated_return_time: input.estimatedReturnTime,
        route_notes: input.routeNotes,
        status: "planned",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!error) {
      data = insertData;
      break;
    }

    // Retry on unique constraint violation (code 23505), otherwise throw
    if (error.code !== "23505" || attempt === maxRetries - 1) {
      logger.dispatch.error("Error creating delivery run", error, { runNumber });
      throw error;
    }
  }

  if (!data) {
    throw new Error("Failed to create delivery run after retries");
  }

  // If orderIds provided, add them to the run
  if (input.orderIds && input.orderIds.length > 0) {
    for (let i = 0; i < input.orderIds.length; i++) {
      await addOrderToDeliveryRun({
        deliveryRunId: data.id,
        orderId: input.orderIds[i],
        sequenceNumber: i + 1,
        trolleysDelivered: 0,
      });
    }
  }

  return data.id;
}

/**
 * Update a delivery run
 */
export async function updateDeliveryRun(
  runId: string,
  updates: Partial<CreateDeliveryRun & { status: string }>
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const dbUpdates: DeliveryRunUpdate = {};
  if (updates.driverName !== undefined) dbUpdates.driver_name = updates.driverName;
  if (updates.vehicleRegistration !== undefined) dbUpdates.vehicle_registration = updates.vehicleRegistration;
  if (updates.vehicleType !== undefined) dbUpdates.vehicle_type = updates.vehicleType;
  if (updates.plannedDepartureTime !== undefined) dbUpdates.planned_departure_time = updates.plannedDepartureTime;
  if (updates.estimatedReturnTime !== undefined) dbUpdates.estimated_return_time = updates.estimatedReturnTime;
  if (updates.routeNotes !== undefined) dbUpdates.route_notes = updates.routeNotes;
  if (updates.status !== undefined) dbUpdates.status = updates.status as DeliveryRunUpdate["status"];

  const { error } = await supabase
    .from("delivery_runs")
    .update(dbUpdates)
    .eq("id", runId);

  if (error) {
    logger.dispatch.error("Error updating delivery run", error, { runId });
    throw error;
  }

  // When a run goes out, use the atomic dispatch_load RPC to mark linked orders as dispatched
  // This ensures all updates (run status, order statuses, timestamps) happen in a single transaction
  if (updates.status === "in_transit") {
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "dispatch_load",
      { p_load_id: runId }
    );

    if (rpcError) {
      logger.dispatch.error("RPC error dispatching load via updateDeliveryRun", rpcError, { runId });
      throw rpcError;
    }

    if (!result?.success) {
      logger.dispatch.error("dispatch_load failed", null, { runId, error: result?.error });
      throw new Error(result?.error || "Failed to dispatch load");
    }
  }
}

// ================================================
// DELIVERY ITEMS
// ================================================

/**
 * Add an order to a delivery run
 */
export async function addOrderToDeliveryRun(input: AddToDeliveryRun): Promise<string> {
  const { user, orgId, supabase } = await getUserAndOrg();

  // Get order details to determine trolleys
  const { data: orderData } = await supabase
    .from("orders")
    .select("trolleys_estimated")
    .eq("id", input.orderId)
    .single();

  // Get packing info if available
  const { data: packingData } = await supabase
    .from("order_packing")
    .select("trolleys_used")
    .eq("order_id", input.orderId)
    .single();

  // Use nullish coalescing to allow explicit 0 values
  const trolleysDelivered =
    input.trolleysDelivered ??
    packingData?.trolleys_used ??
    orderData?.trolleys_estimated ??
    0;

  // Determine sequence number if not provided
  let sequenceNumber = input.sequenceNumber;
  if (!sequenceNumber) {
    const { data: existingItems } = await supabase
      .from("delivery_items")
      .select("sequence_number")
      .eq("delivery_run_id", input.deliveryRunId)
      .order("sequence_number", { ascending: false })
      .limit(1);

    sequenceNumber = existingItems && existingItems.length > 0
      ? existingItems[0].sequence_number + 1
      : 1;
  }

  const { data, error } = await supabase
    .from("delivery_items")
    .insert({
      id: generateId(),
      org_id: orgId,
      delivery_run_id: input.deliveryRunId,
      order_id: input.orderId,
      sequence_number: sequenceNumber,
      delivery_window_start: input.deliveryWindowStart,
      delivery_window_end: input.deliveryWindowEnd,
      trolleys_delivered: trolleysDelivered,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    logger.dispatch.error("Error adding order to delivery run", error, { deliveryRunId: input.deliveryRunId, orderId: input.orderId });
    throw error;
  }

  // Mark order packed (ready for dispatch - final dispatch happens when run goes in transit)
  await supabase
    .from("orders")
    .update({ status: "packed" })
    .eq("id", input.orderId);

  return data.id;
}

/**
 * Update a delivery item
 */
export async function updateDeliveryItem(
  itemId: string,
  updates: UpdateDeliveryItem
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const dbUpdates: DeliveryItemUpdate = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.recipientName !== undefined) dbUpdates.recipient_name = updates.recipientName;
  if (updates.deliveryNotes !== undefined) dbUpdates.delivery_notes = updates.deliveryNotes;
  if (updates.trolleysReturned !== undefined) dbUpdates.trolleys_returned = updates.trolleysReturned;
  if (updates.actualDeliveryTime !== undefined) dbUpdates.actual_delivery_time = updates.actualDeliveryTime;
  if (updates.failureReason !== undefined) dbUpdates.failure_reason = updates.failureReason;

  const { error } = await supabase
    .from("delivery_items")
    .update(dbUpdates)
    .eq("id", itemId);

  if (error) {
    logger.dispatch.error("Error updating delivery item", error, { itemId });
    throw error;
  }

  // If status is delivered, update order status
  if (updates.status === "delivered") {
    const { data: item } = await supabase
      .from("delivery_items")
      .select("order_id")
      .eq("id", itemId)
      .single();

    if (item) {
      await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", item.order_id);
    }
  }
}

// ================================================
// ORDER PACKING
// ================================================

/**
 * Get orders ready for dispatch
 */
export async function getOrdersReadyForDispatch(): Promise<OrderReadyForDispatch[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("v_orders_ready_for_dispatch")
    .select("*")
    .eq("org_id", orgId);

  if (error) {
    logger.dispatch.error("Error fetching orders ready for dispatch", error);
    throw error;
  }

  // Type for the view result
  type OrderReadyRow = {
    id: string;
    order_number: string;
    org_id: string;
    customer_id: string;
    customer_name: string;
    requested_delivery_date: string | null;
    total_inc_vat: number;
    packing_status: string | null;
    trolleys_used: number | null;
    delivery_status: string;
  };

  return (data as OrderReadyRow[]).map((d) => ({
    id: d.id,
    orderNumber: d.order_number,
    orgId: d.org_id,
    customerId: d.customer_id,
    customerName: d.customer_name,
    requestedDeliveryDate: d.requested_delivery_date ?? undefined,
    totalIncVat: d.total_inc_vat,
    packingStatus: d.packing_status as OrderReadyForDispatch["packingStatus"],
    trolleysUsed: d.trolleys_used ?? undefined,
    deliveryStatus: d.delivery_status,
  }));
}

/**
 * Get or create packing record for an order
 */
export async function getOrCreateOrderPacking(orderId: string): Promise<OrderPacking> {
  const { user, orgId, supabase } = await getUserAndOrg();

  // Check if packing record exists
  const { data: existing } = await supabase
    .from("order_packing")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (existing) {
    return mapOrderPackingFromDb(existing);
  }

  // Create new packing record
  const { data, error } = await supabase
    .from("order_packing")
    .insert({
      id: generateId(),
      org_id: orgId,
      order_id: orderId,
      status: "not_started",
    })
    .select("*")
    .single();

  if (error) {
    logger.dispatch.error("Error creating order packing", error, { orderId });
    throw error;
  }

  return mapOrderPackingFromDb(data as OrderPackingRow);
}

/**
 * Update order packing
 */
export async function updateOrderPacking(
  orderId: string,
  updates: UpdatePacking
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const dbUpdates: OrderPackingUpdate = {};
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status;
    if (updates.status === "in_progress") {
      dbUpdates.packing_started_at = new Date().toISOString();
    }
    if (updates.status === "completed") {
      dbUpdates.packing_completed_at = new Date().toISOString();
    }
    if (updates.status === "verified") {
      dbUpdates.verified_at = new Date().toISOString();
      dbUpdates.verified_by = user.id;
    }
  }
  if (updates.trolleysUsed !== undefined) dbUpdates.trolleys_used = updates.trolleysUsed;
  if (updates.totalUnits !== undefined) dbUpdates.total_units = updates.totalUnits;
  if (updates.packingNotes !== undefined) dbUpdates.packing_notes = updates.packingNotes;
  if (updates.specialInstructions !== undefined) dbUpdates.special_instructions = updates.specialInstructions;

  const { error } = await supabase
    .from("order_packing")
    .update(dbUpdates)
    .eq("order_id", orderId);

  if (error) {
    logger.dispatch.error("Error updating order packing", error, { orderId });
    throw error;
  }

  // Update order status if packing is completed
  if (updates.status === "completed" || updates.status === "verified") {
    await supabase
      .from("orders")
      .update({ status: "packed" })
      .eq("id", orderId);
  }
}

// ================================================
// TROLLEY MANAGEMENT
// ================================================

/**
 * List all trolleys with optional filtering
 */
export async function listTrolleys(filters?: { status?: string }): Promise<Trolley[]> {
  const { orgId, supabase } = await getUserAndOrg();

  let query = supabase
    .from("trolleys")
    .select("*, customers(name), delivery_runs(run_number)")
    .eq("org_id", orgId)
    .order("trolley_number", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    logger.trolley.error("Error listing trolleys", error);
    throw error;
  }

  return (data as TrolleyRowWithJoins[]).map((d) => mapTrolleyFromDb(d));
}

/**
 * Get customer trolley balances
 */
export async function getCustomerTrolleyBalances(): Promise<CustomerTrolleySummary[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("v_customer_trolley_summary")
    .select("*")
    .eq("org_id", orgId);

  if (error) {
    logger.trolley.error("Error fetching customer trolley balances", error);
    throw error;
  }

  // Type for the view result
  type TrolleySummaryRow = {
    customer_id: string;
    customer_name: string;
    org_id: string;
    trolleys_outstanding: number;
    last_delivery_date: string | null;
    last_return_date: string | null;
    days_outstanding: number | null;
  };

  return (data as TrolleySummaryRow[]).map((d) => ({
    customerId: d.customer_id,
    customerName: d.customer_name,
    orgId: d.org_id,
    trolleysOutstanding: d.trolleys_outstanding,
    lastDeliveryDate: d.last_delivery_date ?? undefined,
    lastReturnDate: d.last_return_date ?? undefined,
    daysOutstanding: d.days_outstanding ?? undefined,
  }));
}

/**
 * Create a new trolley
 */
export async function createTrolley(input: CreateTrolley): Promise<string> {
  const { user, orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("trolleys")
    .insert({
      id: generateId(),
      org_id: orgId,
      trolley_number: input.trolleyNumber,
      trolley_type: input.trolleyType,
      status: input.status,
      condition_notes: input.conditionNotes,
    })
    .select("id")
    .single();

  if (error) {
    logger.trolley.error("Error creating trolley", error, { trolleyNumber: input.trolleyNumber });
    throw error;
  }

  return data.id;
}

/**
 * Record a trolley transaction
 */
export async function recordTrolleyTransaction(
  input: CreateTrolleyTransaction
): Promise<string> {
  const { user, orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("trolley_transactions")
    .insert({
      id: generateId(),
      org_id: orgId,
      trolley_id: input.trolleyId,
      transaction_type: input.transactionType,
      quantity: input.quantity,
      customer_id: input.customerId,
      delivery_run_id: input.deliveryRunId,
      delivery_item_id: input.deliveryItemId,
      notes: input.notes,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    logger.trolley.error("Error recording trolley transaction", error, { trolleyId: input.trolleyId, transactionType: input.transactionType });
    throw error;
  }

  // Update trolley status based on transaction type
  const statusMap: Record<string, string> = {
    loaded: "loaded",
    delivered: "at_customer",
    returned: "available",
    damaged: "damaged",
    lost: "lost",
  };

  if (statusMap[input.transactionType]) {
    await supabase
      .from("trolleys")
      .update({
        status: statusMap[input.transactionType],
        customer_id: input.transactionType === "delivered" ? input.customerId : null,
        delivery_run_id: input.transactionType === "loaded" ? input.deliveryRunId : null,
      })
      .eq("id", input.trolleyId);
  }

  return data.id;
}

// ================================================
// ORDER STATUS UPDATES
// ================================================

/**
 * Create an order status update
 */
export async function createOrderStatusUpdate(
  input: CreateOrderStatusUpdate
): Promise<string> {
  const { user, orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("order_status_updates")
    .insert({
      id: generateId(),
      org_id: orgId,
      order_id: input.orderId,
      delivery_item_id: input.deliveryItemId,
      status_type: input.statusType,
      title: input.title,
      message: input.message,
      visible_to_customer: input.visibleToCustomer,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    logger.dispatch.error("Error creating order status update", error, { orderId: input.orderId, statusType: input.statusType });
    throw error;
  }

  return data.id;
}

/**
 * Get order status updates for an order
 */
export async function getOrderStatusUpdates(orderId: string): Promise<OrderStatusUpdate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("order_status_updates")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.dispatch.error("Error fetching order status updates", error, { orderId });
    throw error;
  }

  return (data as OrderStatusUpdateRow[]).map(mapOrderStatusUpdateFromDb);
}

// ================================================
// DISPATCH BOARD DATA
// ================================================

// Type for grower members (employees who can pick orders)
export interface GrowerMember {
  id: string;
  name: string;
  email?: string;
}

/**
 * Get org members for picker assignment
 * Returns all members who can be pickers (grower, staff, admin, owner, editor)
 */
export async function getGrowerMembers(orgId: string): Promise<GrowerMember[]> {
  const supabase = await createClient();

  try {
    // Get org members with roles that can be pickers
    // Valid roles: admin, editor, grower, owner, sales, staff, viewer
    // Use explicit FK hint to avoid ambiguity with PostgREST
    const { data, error } = await supabase
      .from("org_memberships")
      .select("user_id, role, profiles:profiles!org_memberships_user_id_profiles_fkey(id, display_name, full_name)")
      .eq("org_id", orgId)
      .in("role", ["grower", "admin", "owner", "editor", "staff"]);

    if (error) {
      // If profiles join fails, try without it
      logger.dispatch.warn("Could not fetch org members with profiles", { error: error.message, orgId });

      // Fallback: just get user_ids with valid roles
      const { data: fallbackData } = await supabase
        .from("org_memberships")
        .select("user_id, role")
        .eq("org_id", orgId)
        .in("role", ["grower", "admin", "owner", "editor", "staff"]);

      type MembershipRow = { user_id: string; role: string };
      return ((fallbackData || []) as MembershipRow[]).map((m) => ({
        id: m.user_id,
        name: m.role || "Staff",
        email: undefined,
      }));
    }

    // Type for the query result with profile join - PostgREST may return single object or array
    type ProfileData = { id: string; display_name: string | null; full_name: string | null };
    type MembershipWithProfile = {
      user_id: string;
      role: string;
      profiles: ProfileData | ProfileData[] | null;
    };

    return ((data || []) as unknown as MembershipWithProfile[])
      .filter((m) => m.profiles)
      .map((m) => {
        // Handle both single object and array cases from PostgREST
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          id: m.user_id,
          name: profile?.display_name || profile?.full_name || "Unknown",
          email: undefined,
        };
      });
  } catch (err) {
    logger.dispatch.error("Error in getGrowerMembers", err, { orgId });
    return [];
  }
}

export async function getHauliers(): Promise<Haulier[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("hauliers")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    // If table doesn't exist, return empty
    if (error.code === "42P01") return [];
    logger.dispatch.error("Error fetching hauliers", error);
    return [];
  }

  return (data as HaulierRow[]).map((d) => ({
    id: d.id,
    orgId: d.org_id,
    name: d.name,
    phone: d.phone ?? undefined,
    email: d.email ?? undefined,
    notes: d.notes ?? undefined,
    isActive: d.is_active,
    isInternal: d.is_internal ?? true,
    trolleyCapacity: d.trolley_capacity ?? 20,
  }));
}

export async function getHauliersWithVehicles(): Promise<HaulierWithVehicles[]> {
  const { orgId, supabase } = await getUserAndOrg();

  // Single query with nested vehicles using Supabase's foreign key relationship
  const { data: hauliersData, error: hauliersError } = await supabase
    .from("hauliers")
    .select(`
      *,
      haulier_vehicles(*)
    `)
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (hauliersError) {
    logger.dispatch.error("Error fetching hauliers with vehicles", hauliersError);
    return [];
  }

  // Type for the nested query result
  type HaulierWithVehiclesRow = HaulierRow & {
    haulier_vehicles: HaulierVehicleRow[];
  };

  // Map results - vehicles are already nested
  return ((hauliersData || []) as HaulierWithVehiclesRow[]).map((h) => {
    const vehicles = (h.haulier_vehicles || [])
      .filter((v) => v.is_active !== false)
      .map((v) => {
        // Cast vehicle type to the expected union type
        const vehicleType = v.vehicle_type as HaulierVehicle["vehicleType"];
        return {
          id: v.id,
          orgId: v.org_id,
          haulierId: v.haulier_id,
          name: v.name,
          registration: v.registration ?? undefined,
          vehicleType,
          trolleyCapacity: v.trolley_capacity ?? 10,
          isActive: v.is_active ?? true,
        };
      });

    return {
      id: h.id,
      orgId: h.org_id,
      name: h.name,
      contactName: undefined, // Not in HaulierRow
      contactPhone: h.phone ?? undefined,
      contactEmail: h.email ?? undefined,
      notes: h.notes ?? undefined,
      trolleyCapacity: h.trolley_capacity ?? 20,
      isActive: h.is_active ?? true,
      isInternal: h.is_internal ?? true,
      createdAt: h.created_at,
      updatedAt: h.updated_at,
      vehicles,
    };
  });
}

export async function getDispatchBoardData(options?: {
  dateWindowDays?: number;
  includeRunStatuses?: DeliveryRunStatusType[];
  includeOrderStatuses?: string[];
}): Promise<{
  orders: DispatchBoardOrder[];
  hauliers: HaulierWithVehicles[];
  growers: GrowerMember[];
  routes: AttributeOption[];
  deliveryRuns: ActiveDeliveryRunSummary[];
}> {
  const { user, orgId, supabase } = await getUserAndOrg();
  const dateWindowDays = options?.dateWindowDays ?? 7;
  // Valid order_status enum: draft, confirmed, picking, packed, dispatched, delivered, cancelled
  const orderStatuses = options?.includeOrderStatuses?.length
    ? options.includeOrderStatuses
    : ["confirmed", "picking", "packed", "dispatched"];

  // Limit board to a window around today to keep payload small
  const today = new Date();
  const startDate = new Date(today);
  const endDate = new Date(today);
  startDate.setDate(today.getDate() - dateWindowDays);
  endDate.setDate(today.getDate() + dateWindowDays);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // Fetch data in parallel
  const [hauliers, growers, routesResult, activeRuns, ordersData] = await Promise.all([
    getHauliersWithVehicles(),
    getGrowerMembers(orgId),
    listAttributeOptions({ orgId, attributeKey: "delivery_route" }),
    getActiveDeliveryRuns({
      statuses: options?.includeRunStatuses,
      runDateWindow: { start: startDateStr, end: endDateStr },
    }),
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_id,
        status,
        requested_delivery_date,
        trolleys_estimated,
        total_inc_vat,
        customers(name),
        customer_addresses(
          line1, city, county, eircode
        ),
        pick_lists(id, assigned_team_id, assigned_user_id, status, trolleys_used),
        order_packing(status),
        delivery_items(id, delivery_run_id, status, delivery_runs(run_number, haulier_id, status))
      `)
      .eq("org_id", orgId)
      .in("status", orderStatuses)
      .gte("requested_delivery_date", startDateStr)
      .lte("requested_delivery_date", endDateStr)
      .order("requested_delivery_date", { ascending: true })
  ]);

  if (ordersData.error) {
    logger.dispatch.error("Error fetching dispatch board orders", ordersData.error);
    throw new Error(`Failed to fetch orders: ${ordersData.error.message}`);
  }

  // Type for the nested query result - PostgREST returns arrays/objects based on relationship
  type CustomerData = { name: string };
  type AddressData = { line1: string; city: string | null; county: string | null; eircode: string | null };
  type PickListData = { id: string; assigned_team_id: string | null; assigned_user_id: string | null; status: string; trolleys_used: number | null };
  type PackingData = { status: string };
  type DeliveryRunData = { run_number: string; haulier_id: string | null; status: string };
  type DeliveryItemData = { id: string; delivery_run_id: string | null; status: string; delivery_runs: DeliveryRunData | DeliveryRunData[] | null };

  // Use unknown as intermediate step to handle Supabase's dynamic typing
  const ordersDataTyped = ordersData.data as unknown as Array<{
    id: string;
    order_number: string;
    customer_id: string;
    status: string;
    requested_delivery_date: string | null;
    trolleys_estimated: number | null;
    total_inc_vat: number;
    customers: CustomerData | CustomerData[] | null;
    customer_addresses: AddressData | AddressData[] | null;
    pick_lists: PickListData | PickListData[] | null;
    order_packing: PackingData | PackingData[] | null;
    delivery_items: DeliveryItemData | DeliveryItemData[] | null;
  }>;

  const orders: DispatchBoardOrder[] = ordersDataTyped.map((o) => {
    // Helper to normalize PostgREST results that could be arrays or single objects
    const asArray = <T>(val: T | T[] | null): T[] => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    };
    const asSingle = <T>(val: T | T[] | null): T | null => {
      if (!val) return null;
      return Array.isArray(val) ? val[0] ?? null : val;
    };

    const pickLists = asArray(o.pick_lists);
    const pickList = pickLists[0];

    const packingRecords = asArray(o.order_packing);
    const packingRecord = packingRecords[0];

    const deliveryItems = asArray(o.delivery_items);
    const deliveryItem = deliveryItems.find((di) => di.delivery_run_id);
    const deliveryRun = deliveryItem ? asSingle(deliveryItem.delivery_runs) : null;

    // Look up haulier name from the hauliers list (no FK constraint in DB)
    const haulierId = deliveryRun?.haulier_id ?? undefined;
    const haulierName = haulierId ? hauliers.find(h => h.id === haulierId)?.name : undefined;

    // Get picker info - assigned_user_id may not exist until migration is run
    // If the column exists, it will be in the data; otherwise pickerId stays undefined
    const pickerId = pickList?.assigned_user_id ?? undefined;
    const pickerName = pickerId ? growers.find(g => g.id === pickerId)?.name : undefined;

    // Route name comes from the delivery run number for now
    // Route colors can be matched by run number prefix if routes follow naming conventions
    const routeName = deliveryRun?.run_number;
    const routeColor: string | undefined = undefined; // Will be populated when route_name column is added

    // Compute Stage (simplified workflow: To Pick -> Picking -> Ready to Load -> On Route)
    let stage: DispatchStage = "to_pick";
    const runStatus = deliveryRun?.status;

    if (deliveryItem?.delivery_run_id && runStatus && ["in_transit", "completed"].includes(runStatus)) {
      // Actively out for delivery
      stage = "on_route";
    } else if (pickList?.status === "completed" || packingRecord?.status === "completed" || packingRecord?.status === "verified") {
      // Picking done (or packing done) = Ready to load onto truck
      stage = "ready_to_load";
    } else if (pickerId || pickList?.status === "in_progress") {
      // Picker assigned or actively picking
      stage = "picking";
    }
    // Default: "to_pick" - needs picker assignment

    // Normalize nested objects
    const customer = asSingle(o.customers);
    const address = asSingle(o.customer_addresses);

    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: customer?.name || "Unknown",
      customerId: o.customer_id,
      county: address?.county ?? undefined,
      eircode: address?.eircode ?? undefined,
      requestedDeliveryDate: o.requested_delivery_date ?? undefined,
      trolleysEstimated: o.trolleys_estimated || 0,
      trolleysActual: pickList?.trolleys_used ?? null,
      totalIncVat: o.total_inc_vat,
      status: o.status,
      stage,

      // Picking - now uses individual picker (grower) instead of team
      pickListId: pickList?.id,
      pickerId,
      pickerName,
      pickListStatus: pickList?.status,

      // Delivery
      deliveryItemId: deliveryItem?.id,
      deliveryRunId: deliveryItem?.delivery_run_id ?? undefined,
      deliveryRunNumber: deliveryRun?.run_number,
      routeName,
      routeColor,
      haulierId,
      haulierName,
      deliveryItemStatus: deliveryItem?.status,
    };
  });

  return {
    orders,
    hauliers,
    growers,
    routes: routesResult.options,
    deliveryRuns: activeRuns
  };
}

// ================================================
// MAPPER FUNCTIONS
// ================================================

function mapDeliveryRunFromDb(d: DeliveryRunRow): DeliveryRun {
  return {
    id: d.id,
    orgId: d.org_id,
    runNumber: d.run_number,
    runDate: d.run_date,
    loadCode: d.load_name ?? undefined,
    weekNumber: d.week_number ?? undefined,
    haulierId: d.haulier_id ?? undefined,
    vehicleId: d.vehicle_id ?? undefined,
    driverName: d.driver_name ?? undefined,
    vehicleRegistration: d.vehicle_registration ?? undefined,
    vehicleType: (d.vehicle_type as "van" | "truck" | "trailer" | undefined) ?? undefined,
    plannedDepartureTime: d.planned_departure_time ?? undefined,
    actualDepartureTime: d.actual_departure_time ?? undefined,
    estimatedReturnTime: d.estimated_return_time ?? undefined,
    actualReturnTime: d.actual_return_time ?? undefined,
    status: d.status,
    trolleysLoaded: d.trolleys_loaded,
    trolleysReturned: d.trolleys_returned,
    routeNotes: d.route_notes ?? undefined,
    displayOrder: d.display_order ?? 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    createdBy: d.created_by ?? undefined,
  };
}

function mapDeliveryItemFromDb(d: DeliveryItemRow): DeliveryItem {
  return {
    id: d.id,
    orgId: d.org_id,
    deliveryRunId: d.delivery_run_id,
    orderId: d.order_id,
    sequenceNumber: d.sequence_number,
    estimatedDeliveryTime: d.estimated_delivery_time ?? undefined,
    actualDeliveryTime: d.actual_delivery_time ?? undefined,
    deliveryWindowStart: d.delivery_window_start ?? undefined,
    deliveryWindowEnd: d.delivery_window_end ?? undefined,
    status: d.status,
    trolleysDelivered: d.trolleys_delivered,
    trolleysReturned: d.trolleys_returned,
    trolleysOutstanding: d.trolleys_outstanding ?? 0,
    recipientName: d.recipient_name ?? undefined,
    recipientSignatureUrl: d.recipient_signature_url ?? undefined,
    deliveryNotes: d.delivery_notes ?? undefined,
    deliveryPhotoUrl: d.delivery_photo_url ?? undefined,
    failureReason: d.failure_reason ?? undefined,
    rescheduledTo: d.rescheduled_to ?? undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapOrderPackingFromDb(d: OrderPackingRow): OrderPacking {
  return {
    id: d.id,
    orgId: d.org_id,
    orderId: d.order_id,
    status: d.status,
    trolleysUsed: d.trolleys_used,
    totalUnits: d.total_units ?? undefined,
    verifiedBy: d.verified_by ?? undefined,
    verifiedAt: d.verified_at ?? undefined,
    packingNotes: d.packing_notes ?? undefined,
    specialInstructions: d.special_instructions ?? undefined,
    packingStartedAt: d.packing_started_at ?? undefined,
    packingCompletedAt: d.packing_completed_at ?? undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

/** Trolley row with optional joined customer and delivery run */
type TrolleyRowWithJoins = TrolleyRow & {
  customers?: { name: string } | null;
  delivery_runs?: { run_number: string } | null;
};

function mapTrolleyFromDb(d: TrolleyRowWithJoins): Trolley {
  return {
    id: d.id,
    orgId: d.org_id,
    trolleyNumber: d.trolley_number,
    trolleyType: d.trolley_type ?? "danish",
    status: d.status,
    currentLocation: d.current_location ?? undefined,
    customerId: d.customer_id ?? undefined,
    deliveryRunId: d.delivery_run_id ?? undefined,
    conditionNotes: d.condition_notes ?? undefined,
    lastInspectionDate: d.last_inspection_date ?? undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    customerName: d.customers?.name,
    runNumber: d.delivery_runs?.run_number,
  };
}

function mapOrderStatusUpdateFromDb(d: OrderStatusUpdateRow): OrderStatusUpdate {
  return {
    id: d.id,
    orgId: d.org_id,
    orderId: d.order_id,
    deliveryItemId: d.delivery_item_id ?? undefined,
    // Cast to expected union type - DB stores as string
    statusType: d.status_type as OrderStatusUpdate["statusType"],
    title: d.title,
    message: d.message ?? undefined,
    visibleToCustomer: d.visible_to_customer,
    customerNotifiedAt: d.customer_notified_at ?? undefined,
    createdAt: d.created_at,
    createdBy: d.created_by ?? undefined,
  };
}
