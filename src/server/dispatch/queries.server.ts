import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Haulier } from "@/lib/types";
import { listAttributeOptions } from "@/server/attributeOptions/service";
import type { AttributeOption } from "@/lib/attributeOptions";
import type {
  DeliveryRun,
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  let query = supabase
    .from("delivery_runs")
    .select("*")
    .eq("org_id", membership.org_id)
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
    console.error("Error listing delivery runs:", error);
    throw error;
  }

  return data.map(mapDeliveryRunFromDb);
}

/**
 * Get active delivery runs with item counts
 */
export async function getActiveDeliveryRuns(): Promise<ActiveDeliveryRunSummary[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("v_active_delivery_runs")
    .select("*")
    .eq("org_id", membership.org_id);

  if (error) {
    console.error("Error fetching active delivery runs:", error);
    throw error;
  }

  return data.map((d: any) => ({
    id: d.id,
    runNumber: d.run_number,
    orgId: d.org_id,
    runDate: d.run_date,
    status: d.status,
    driverName: d.driver_name,
    vehicleRegistration: d.vehicle_registration,
    trolleysLoaded: d.trolleys_loaded,
    trolleysReturned: d.trolleys_returned,
    trolleysOutstanding: d.trolleys_outstanding,
    totalDeliveries: d.total_deliveries,
    completedDeliveries: d.completed_deliveries,
    pendingDeliveries: d.pending_deliveries,
    haulierId: d.haulier_id,
    haulierName: d.hauliers?.name // Note: v_active_delivery_runs view might need hauliers joined or it might not be there. 
                                  // If it's not in the view, this will be undefined. 
                                  // Ideally the view should include it.
  }));
}

/**
 * Get a single delivery run with all its items
 */
export async function getDeliveryRunWithItems(runId: string): Promise<DeliveryRunWithItems | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  // Get delivery run
  const { data: runData, error: runError } = await supabase
    .from("delivery_runs")
    .select("*")
    .eq("id", runId)
    .eq("org_id", membership.org_id)
    .single();

  if (runError || !runData) {
    console.error("Error fetching delivery run:", runError);
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
    console.error("Error fetching delivery items:", itemsError);
    throw itemsError;
  }

  const items = (itemsData || []).map((item: any) => ({
    ...mapDeliveryItemFromDb(item),
    order: {
      orderNumber: item.orders?.order_number || "",
      customerId: item.orders?.customer_id || "",
      customerName: item.orders?.customers?.name || "Unknown",
      totalIncVat: item.orders?.total_inc_vat || 0,
      requestedDeliveryDate: item.orders?.requested_delivery_date,
      shipToAddress: item.orders?.customer_addresses
        ? {
            line1: item.orders.customer_addresses.line1,
            line2: item.orders.customer_addresses.line2,
            city: item.orders.customer_addresses.city,
            county: item.orders.customer_addresses.county,
            eircode: item.orders.customer_addresses.eircode,
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  // Generate run number (format: DR-YYYYMMDD-NNN)
  const datePart = input.runDate.replace(/-/g, "");
  const { data: existingRuns } = await supabase
    .from("delivery_runs")
    .select("run_number")
    .eq("org_id", membership.org_id)
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

  const { data, error } = await supabase
    .from("delivery_runs")
    .insert({
      id: generateId(),
      org_id: membership.org_id,
      run_number: runNumber,
      run_date: input.runDate,
      haulier_id: input.haulierId,
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

  if (error) {
    console.error("Error creating delivery run:", error);
    throw error;
  }

  // If orderIds provided, add them to the run
  if (input.orderIds && input.orderIds.length > 0) {
    for (let i = 0; i < input.orderIds.length; i++) {
      await addOrderToDeliveryRun({
        deliveryRunId: data.id,
        orderId: input.orderIds[i],
        sequenceNumber: i + 1,
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

  const dbUpdates: any = {};
  if (updates.driverName !== undefined) dbUpdates.driver_name = updates.driverName;
  if (updates.vehicleRegistration !== undefined) dbUpdates.vehicle_registration = updates.vehicleRegistration;
  if (updates.vehicleType !== undefined) dbUpdates.vehicle_type = updates.vehicleType;
  if (updates.plannedDepartureTime !== undefined) dbUpdates.planned_departure_time = updates.plannedDepartureTime;
  if (updates.estimatedReturnTime !== undefined) dbUpdates.estimated_return_time = updates.estimatedReturnTime;
  if (updates.routeNotes !== undefined) dbUpdates.route_notes = updates.routeNotes;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { error } = await supabase
    .from("delivery_runs")
    .update(dbUpdates)
    .eq("id", runId);

  if (error) {
    console.error("Error updating delivery run:", error);
    throw error;
  }
}

// ================================================
// DELIVERY ITEMS
// ================================================

/**
 * Add an order to a delivery run
 */
export async function addOrderToDeliveryRun(input: AddToDeliveryRun): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

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

  const trolleysDelivered =
    input.trolleysDelivered ||
    packingData?.trolleys_used ||
    orderData?.trolleys_estimated ||
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
      org_id: membership.org_id,
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
    console.error("Error adding order to delivery run:", error);
    throw error;
  }

  // Update order status to dispatched
  await supabase
    .from("orders")
    .update({ status: "dispatched" })
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

  const dbUpdates: any = {};
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
    console.error("Error updating delivery item:", error);
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("v_orders_ready_for_dispatch")
    .select("*")
    .eq("org_id", membership.org_id);

  if (error) {
    console.error("Error fetching orders ready for dispatch:", error);
    throw error;
  }

  return data.map((d: any) => ({
    id: d.id,
    orderNumber: d.order_number,
    orgId: d.org_id,
    customerId: d.customer_id,
    customerName: d.customer_name,
    requestedDeliveryDate: d.requested_delivery_date,
    totalIncVat: d.total_inc_vat,
    packingStatus: d.packing_status,
    trolleysUsed: d.trolleys_used,
    deliveryStatus: d.delivery_status,
  }));
}

/**
 * Get or create packing record for an order
 */
export async function getOrCreateOrderPacking(orderId: string): Promise<OrderPacking> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

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
      org_id: membership.org_id,
      order_id: orderId,
      status: "not_started",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating order packing:", error);
    throw error;
  }

  return mapOrderPackingFromDb(data);
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

  const dbUpdates: any = {};
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status;
    if (updates.status === "in_progress" && !updates.status) {
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
    console.error("Error updating order packing:", error);
    throw error;
  }

  // Update order status if packing is completed
  if (updates.status === "completed" || updates.status === "verified") {
    await supabase
      .from("orders")
      .update({ status: "ready_for_dispatch" })
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  let query = supabase
    .from("trolleys")
    .select("*, customers(name), delivery_runs(run_number)")
    .eq("org_id", membership.org_id)
    .order("trolley_number", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error listing trolleys:", error);
    throw error;
  }

  return data.map((d: any) => mapTrolleyFromDb(d));
}

/**
 * Get customer trolley balances
 */
export async function getCustomerTrolleyBalances(): Promise<CustomerTrolleySummary[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("v_customer_trolley_summary")
    .select("*")
    .eq("org_id", membership.org_id);

  if (error) {
    console.error("Error fetching customer trolley balances:", error);
    throw error;
  }

  return data.map((d: any) => ({
    customerId: d.customer_id,
    customerName: d.customer_name,
    orgId: d.org_id,
    trolleysOutstanding: d.trolleys_outstanding,
    lastDeliveryDate: d.last_delivery_date,
    lastReturnDate: d.last_return_date,
    daysOutstanding: d.days_outstanding,
  }));
}

/**
 * Create a new trolley
 */
export async function createTrolley(input: CreateTrolley): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("trolleys")
    .insert({
      id: generateId(),
      org_id: membership.org_id,
      trolley_number: input.trolleyNumber,
      trolley_type: input.trolleyType,
      status: input.status,
      condition_notes: input.conditionNotes,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating trolley:", error);
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("trolley_transactions")
    .insert({
      id: generateId(),
      org_id: membership.org_id,
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
    console.error("Error recording trolley transaction:", error);
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("order_status_updates")
    .insert({
      id: generateId(),
      org_id: membership.org_id,
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
    console.error("Error creating order status update:", error);
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
    console.error("Error fetching order status updates:", error);
    throw error;
  }

  return data.map(mapOrderStatusUpdateFromDb);
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
 * Get org members with 'grower' role for picker assignment
 */
export async function getGrowerMembers(orgId: string): Promise<GrowerMember[]> {
  const supabase = await createClient();
  
  try {
    // First try with profiles join
    const { data, error } = await supabase
      .from("org_memberships")
      .select("user_id, role, profiles(id, full_name, email)")
      .eq("org_id", orgId)
      .eq("role", "grower");

    if (error) {
      // If profiles join fails, try without it
      console.warn("Could not fetch grower members with profiles:", error.message);
      
      // Fallback: just get user_ids
      const { data: fallbackData } = await supabase
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "grower");
      
      return (fallbackData || []).map((m: any) => ({
        id: m.user_id,
        name: "Grower",
        email: undefined,
      }));
    }

    return (data || [])
      .filter((m: any) => m.profiles)
      .map((m: any) => ({
        id: m.user_id,
        name: m.profiles?.full_name || m.profiles?.email || "Unknown",
        email: m.profiles?.email,
      }));
  } catch (err) {
    console.error("Error in getGrowerMembers:", err);
    return [];
  }
}

export async function getHauliers(): Promise<Haulier[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const { data, error } = await supabase
    .from("hauliers")
    .select("*")
    .eq("org_id", membership.org_id)
    .eq("is_active", true)
    .order("name");

  if (error) {
    // If table doesn't exist, return empty
    if (error.code === "42P01") return [];
    console.error("Error fetching hauliers:", error);
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    orgId: d.org_id,
    name: d.name,
    phone: d.phone,
    email: d.email,
    notes: d.notes,
    isActive: d.is_active,
  }));
}

export async function getDispatchBoardData(): Promise<{
  orders: DispatchBoardOrder[];
  hauliers: Haulier[];
  growers: GrowerMember[];
  routes: AttributeOption[];
  deliveryRuns: ActiveDeliveryRunSummary[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No organization membership found");

  const orgId = membership.org_id;

  // Fetch data in parallel
  const [hauliers, growers, routesResult, activeRuns, ordersData] = await Promise.all([
    getHauliers(),
    getGrowerMembers(orgId),
    listAttributeOptions({ orgId, attributeKey: "delivery_route" }),
    getActiveDeliveryRuns(), // Use active runs instead of just planned
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
        pick_lists(id, assigned_team_id, status),
        order_packing(status),
        delivery_items(id, delivery_run_id, status, delivery_runs(run_number, haulier_id))
      `)
      .eq("org_id", orgId)
      .in("status", ["confirmed"])
      .order("requested_delivery_date", { ascending: true })
  ]);

  if (ordersData.error) {
    console.error("Error fetching dispatch board orders:", JSON.stringify(ordersData.error, null, 2));
    throw new Error(`Failed to fetch orders: ${ordersData.error.message}`);
  }

  const orders: DispatchBoardOrder[] = ordersData.data.map((o: any) => {
    const pickLists = Array.isArray(o.pick_lists) ? o.pick_lists : (o.pick_lists ? [o.pick_lists] : []);
    const pickList = pickLists[0];
    
    const packingRecords = Array.isArray(o.order_packing) ? o.order_packing : (o.order_packing ? [o.order_packing] : []);
    const packingRecord = packingRecords[0];

    const deliveryItems = Array.isArray(o.delivery_items) ? o.delivery_items : (o.delivery_items ? [o.delivery_items] : []);
    const deliveryItem = deliveryItems.find((di: any) => di.delivery_run_id);

    // Look up haulier name from the hauliers list (no FK constraint in DB)
    const haulierId = deliveryItem?.delivery_runs?.haulier_id;
    const haulierName = haulierId ? hauliers.find(h => h.id === haulierId)?.name : undefined;

    // Get picker info - assigned_user_id may not exist until migration is run
    // If the column exists, it will be in the data; otherwise pickerId stays undefined
    const pickerId = (pickList as any)?.assigned_user_id;
    const pickerName = pickerId ? growers.find(g => g.id === pickerId)?.name : undefined;

    // Compute Stage (simplified workflow: To Pick -> Picking -> Ready to Load -> On Route)
    let stage: DispatchStage = "to_pick";

    if (deliveryItem?.delivery_run_id) {
      // Assigned to a delivery run
      stage = "on_route";
    } else if (pickList?.status === "completed" || packingRecord?.status === "completed" || packingRecord?.status === "verified") {
      // Picking done (or packing done) = Ready to load onto truck
      stage = "ready_to_load";
    } else if (pickerId || pickList?.status === "in_progress") {
      // Picker assigned or actively picking
      stage = "picking";
    }
    // Default: "to_pick" - needs picker assignment

    return {
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customers?.name || "Unknown",
      county: o.customer_addresses?.county,
      requestedDeliveryDate: o.requested_delivery_date,
      trolleysEstimated: o.trolleys_estimated || 0,
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
      deliveryRunId: deliveryItem?.delivery_run_id,
      deliveryRunNumber: deliveryItem?.delivery_runs?.run_number,
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

// ... (helper functions remain unchanged)
function mapDeliveryRunFromDb(d: any): DeliveryRun {
  return {
    id: d.id,
    orgId: d.org_id,
    runNumber: d.run_number,
    runDate: d.run_date,
    haulierId: d.haulier_id,
    driverName: d.driver_name,
    vehicleRegistration: d.vehicle_registration,
    vehicleType: d.vehicle_type,
    plannedDepartureTime: d.planned_departure_time,
    actualDepartureTime: d.actual_departure_time,
    estimatedReturnTime: d.estimated_return_time,
    actualReturnTime: d.actual_return_time,
    status: d.status,
    trolleysLoaded: d.trolleys_loaded,
    trolleysReturned: d.trolleys_returned,
    routeNotes: d.route_notes,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    createdBy: d.created_by,
  };
}

function mapDeliveryItemFromDb(d: any): DeliveryItem {
  return {
    id: d.id,
    orgId: d.org_id,
    deliveryRunId: d.delivery_run_id,
    orderId: d.order_id,
    sequenceNumber: d.sequence_number,
    estimatedDeliveryTime: d.estimated_delivery_time,
    actualDeliveryTime: d.actual_delivery_time,
    deliveryWindowStart: d.delivery_window_start,
    deliveryWindowEnd: d.delivery_window_end,
    status: d.status,
    trolleysDelivered: d.trolleys_delivered,
    trolleysReturned: d.trolleys_returned,
    trolleysOutstanding: d.trolleys_outstanding,
    recipientName: d.recipient_name,
    recipientSignatureUrl: d.recipient_signature_url,
    deliveryNotes: d.delivery_notes,
    deliveryPhotoUrl: d.delivery_photo_url,
    failureReason: d.failure_reason,
    rescheduledTo: d.rescheduled_to,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapOrderPackingFromDb(d: any): OrderPacking {
  return {
    id: d.id,
    orgId: d.org_id,
    orderId: d.order_id,
    status: d.status,
    trolleysUsed: d.trolleys_used,
    totalUnits: d.total_units,
    verifiedBy: d.verified_by,
    verifiedAt: d.verified_at,
    packingNotes: d.packing_notes,
    specialInstructions: d.special_instructions,
    packingStartedAt: d.packing_started_at,
    packingCompletedAt: d.packing_completed_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapTrolleyFromDb(d: any): Trolley {
  return {
    id: d.id,
    orgId: d.org_id,
    trolleyNumber: d.trolley_number,
    trolleyType: d.trolley_type,
    status: d.status,
    currentLocation: d.current_location,
    customerId: d.customer_id,
    deliveryRunId: d.delivery_run_id,
    conditionNotes: d.condition_notes,
    lastInspectionDate: d.last_inspection_date,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    customerName: d.customers?.name,
    runNumber: d.delivery_runs?.run_number,
  };
}

function mapOrderStatusUpdateFromDb(d: any): OrderStatusUpdate {
  return {
    id: d.id,
    orgId: d.org_id,
    orderId: d.order_id,
    deliveryItemId: d.delivery_item_id,
    statusType: d.status_type,
    title: d.title,
    message: d.message,
    visibleToCustomer: d.visible_to_customer,
    customerNotifiedAt: d.customer_notified_at,
    createdAt: d.created_at,
    createdBy: d.created_by,
  };
}
