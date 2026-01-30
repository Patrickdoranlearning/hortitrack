import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { getUserAndOrg } from "@/server/auth/org";
import type { PickerTask, PickerTaskItem } from "@/lib/dispatch/types";
import { logger } from "@/server/utils/logger";
import type { Database } from "@/lib/database.types";

/** Type alias for the Supabase client with our database schema */
type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Helper to sort tasks by delivery date (soonest first), then by sequence
 */
function sortByDeliveryDate(tasks: PickerTask[]): PickerTask[] {
  return [...tasks].sort((a, b) => {
    // First sort by delivery date (nulls last)
    const dateA = a.requestedDeliveryDate ? new Date(a.requestedDeliveryDate).getTime() : Infinity;
    const dateB = b.requestedDeliveryDate ? new Date(b.requestedDeliveryDate).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    // Then by sequence
    return a.sequence - b.sequence;
  });
}

/**
 * Helper to aggregate item counts and feedback for pick lists
 */
async function aggregatePickListData(
  supabase: TypedSupabaseClient,
  pickListIds: string[]
): Promise<{
  itemCountsMap: Map<string, { totalItems: number; pickedItems: number; totalQty: number; pickedQty: number }>;
  feedbackCountsMap: Map<string, { pendingFeedbackCount: number; unacknowledgedFeedbackCount: number }>;
}> {
  if (pickListIds.length === 0) {
    return {
      itemCountsMap: new Map(),
      feedbackCountsMap: new Map(),
    };
  }

  const [itemResult, feedbackResult] = await Promise.all([
    supabase
      .from("pick_items")
      .select("pick_list_id, status, target_qty, picked_qty")
      .in("pick_list_id", pickListIds),
    supabase
      .from("qc_feedback")
      .select("pick_list_id, resolved_at, picker_acknowledged_at, picker_notified_at")
      .in("pick_list_id", pickListIds),
  ]);

  const itemCounts = itemResult.data || [];
  const feedbackCounts = feedbackResult.data || [];

  // Aggregate item counts
  const itemCountsMap = new Map<string, {
    totalItems: number;
    pickedItems: number;
    totalQty: number;
    pickedQty: number;
  }>();

  for (const item of itemCounts) {
    const existing = itemCountsMap.get(item.pick_list_id) || {
      totalItems: 0,
      pickedItems: 0,
      totalQty: 0,
      pickedQty: 0,
    };
    existing.totalItems += 1;
    if (item.status === "picked" || item.status === "substituted") {
      existing.pickedItems += 1;
    }
    existing.totalQty += item.target_qty || 0;
    existing.pickedQty += item.picked_qty || 0;
    itemCountsMap.set(item.pick_list_id, existing);
  }

  // Aggregate feedback counts
  const feedbackCountsMap = new Map<string, {
    pendingFeedbackCount: number;
    unacknowledgedFeedbackCount: number;
  }>();

  for (const feedback of feedbackCounts) {
    const existing = feedbackCountsMap.get(feedback.pick_list_id) || {
      pendingFeedbackCount: 0,
      unacknowledgedFeedbackCount: 0,
    };
    if (!feedback.resolved_at) {
      existing.pendingFeedbackCount += 1;
    }
    if (!feedback.picker_acknowledged_at && feedback.picker_notified_at) {
      existing.unacknowledgedFeedbackCount += 1;
    }
    feedbackCountsMap.set(feedback.pick_list_id, existing);
  }

  return { itemCountsMap, feedbackCountsMap };
}

/**
 * Fetch order items for a list of order IDs
 */
async function fetchOrderItems(
  supabase: TypedSupabaseClient,
  orderIds: string[]
): Promise<Map<string, PickerTaskItem[]>> {
  if (orderIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("order_items")
    .select(`
      id,
      order_id,
      quantity,
      description,
      skus(
        code,
        plant_varieties(name),
        plant_sizes(name)
      )
    `)
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (error) {
    logger.picking.error("Error fetching order items", error);
    return new Map();
  }

  const itemsMap = new Map<string, PickerTaskItem[]>();

  // Type for the nested SKU query result
  type SkuData = {
    code: string;
    plant_varieties: { name: string } | null;
    plant_sizes: { name: string } | null;
  };

  for (const item of data || []) {
    const orderId = item.order_id;
    const sku = item.skus as SkuData | null;
    
    const taskItem: PickerTaskItem = {
      id: item.id,
      skuCode: sku?.code || "",
      description: item.description || sku?.code || "Unknown",
      varietyName: sku?.plant_varieties?.name || "",
      sizeName: sku?.plant_sizes?.name || "",
      quantity: item.quantity || 0,
    };

    if (!itemsMap.has(orderId)) {
      itemsMap.set(orderId, []);
    }
    itemsMap.get(orderId)!.push(taskItem);
  }

  return itemsMap;
}

/** Nested order type for pick list query */
type PickListOrderData = {
  order_number: string;
  status: string;
  requested_delivery_date: string | null;
  customers: { name: string } | { name: string }[] | null;
};

/** Type for pick list query result with nested order data */
type PickListQueryRow = {
  id: string;
  org_id: string;
  order_id: string;
  assigned_user_id: string | null;
  assigned_team_id: string | null;
  sequence: number;
  status: string;
  qc_status: string | null;
  is_partial: boolean | null;
  merge_status: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  orders: PickListOrderData | PickListOrderData[] | null;
};

/** Helper to get first element from array or value itself */
function asSingle<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

/**
 * Map raw pick list data to PickerTask format
 */
function mapToPickerTask(
  pl: PickListQueryRow,
  itemCountsMap: Map<string, { totalItems: number; pickedItems: number; totalQty: number; pickedQty: number }>,
  feedbackCountsMap: Map<string, { pendingFeedbackCount: number; unacknowledgedFeedbackCount: number }>,
  orderItemsMap?: Map<string, PickerTaskItem[]>
): PickerTask {
  const order = asSingle(pl.orders);
  const customer = order ? asSingle(order.customers) : null;
  const counts = itemCountsMap.get(pl.id) || {
    totalItems: 0,
    pickedItems: 0,
    totalQty: 0,
    pickedQty: 0,
  };
  const feedback = feedbackCountsMap.get(pl.id) || {
    pendingFeedbackCount: 0,
    unacknowledgedFeedbackCount: 0,
  };

  return {
    id: pl.id,
    orgId: pl.org_id,
    orderId: pl.order_id,
    assignedUserId: pl.assigned_user_id || undefined,
    assignedTeamId: pl.assigned_team_id || undefined,
    sequence: pl.sequence,
    status: pl.status,
    qcStatus: pl.qc_status || undefined,
    isPartial: pl.is_partial ?? false,
    mergeStatus: pl.merge_status || undefined,
    startedAt: pl.started_at || undefined,
    completedAt: pl.completed_at || undefined,
    notes: pl.notes || undefined,
    createdAt: pl.created_at,
    orderNumber: order?.order_number || "Unknown",
    orderStatus: order?.status || "unknown",
    requestedDeliveryDate: order?.requested_delivery_date || undefined,
    customerName: customer?.name || "Unknown Customer",
    ...counts,
    ...feedback,
    items: orderItemsMap?.get(pl.order_id) || [],
  };
}

/**
 * Get all picking tasks assigned to the current user
 * Sorted by delivery date (soonest first)
 */
export async function getPickerTasks(): Promise<PickerTask[]> {
  const { user, orgId, supabase } = await getUserAndOrg();

  logger.picking.info("Fetching picker tasks", { userId: user.id, orgId });

  // Fetch pick lists assigned to the current user
  const { data, error } = await supabase
    .from("pick_lists")
    .select(`
      id,
      org_id,
      order_id,
      assigned_user_id,
      assigned_team_id,
      sequence,
      status,
      qc_status,
      is_partial,
      merge_status,
      started_at,
      completed_at,
      notes,
      created_at,
      orders(
        order_number,
        status,
        requested_delivery_date,
        customers(name)
      )
    `)
    .eq("org_id", orgId)
    .eq("assigned_user_id", user.id)
    .in("status", ["pending", "in_progress"])
    .order("sequence", { ascending: true });

  if (error) {
    logger.picking.error("Error fetching picker tasks", error, { userId: user.id, orgId });
    throw new Error(error.message || "Failed to fetch picker tasks");
  }

  logger.picking.info("Found pick lists assigned to user", { count: data?.length || 0, userId: user.id });

  const pickListIds = data.map((pl) => pl.id);
  const orderIds = data.map((pl) => pl.order_id);
  
  const [aggregateData, orderItemsMap] = await Promise.all([
    aggregatePickListData(supabase, pickListIds),
    fetchOrderItems(supabase, orderIds),
  ]);
  
  const { itemCountsMap, feedbackCountsMap } = aggregateData;

  const tasks = data
    .filter((pl) => pl.orders)
    .map((pl) => mapToPickerTask(pl as unknown as PickListQueryRow, itemCountsMap, feedbackCountsMap, orderItemsMap));

  return sortByDeliveryDate(tasks);
}

/**
 * Get all unassigned pick lists that any picker can work on
 * These are pending orders not yet assigned to anyone
 * Sorted by delivery date (soonest first) for priority
 */
export async function getUnassignedPickerTasks(): Promise<PickerTask[]> {
  const { orgId, supabase } = await getUserAndOrg();

  // Fetch pick lists with no assigned user (available for anyone to pick up)
  const { data: pickListData, error: pickListError } = await supabase
    .from("pick_lists")
    .select(`
      id,
      org_id,
      order_id,
      assigned_user_id,
      assigned_team_id,
      sequence,
      status,
      qc_status,
      is_partial,
      merge_status,
      started_at,
      completed_at,
      notes,
      created_at,
      orders(
        order_number,
        status,
        requested_delivery_date,
        customers(name)
      )
    `)
    .eq("org_id", orgId)
    .is("assigned_user_id", null) // Not assigned to anyone
    .eq("status", "pending") // Only pending (not in_progress)
    .order("sequence", { ascending: true });

  if (pickListError) {
    logger.picking.error("Error fetching unassigned picker tasks", pickListError, { orgId });
    throw new Error(pickListError.message || "Failed to fetch unassigned picker tasks");
  }

  // Also fetch orders that are confirmed/picking but don't have a pick list yet
  // First get ALL pick list order IDs (not just unassigned) to exclude
  const { data: allPickLists } = await supabase
    .from("pick_lists")
    .select("order_id")
    .eq("org_id", orgId);
  
  const allPickListOrderIds = new Set((allPickLists || []).map((pl) => pl.order_id));
  
  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      requested_delivery_date,
      customers(name)
    `)
    .eq("org_id", orgId)
    .in("status", ["confirmed", "picking"])
    .order("requested_delivery_date", { ascending: true, nullsFirst: false });

  if (ordersError) {
    logger.picking.error("Error fetching orders without pick list", ordersError, { orgId });
    // Don't throw - just log and continue with pick lists only
  }

  // Filter to only orders that don't have a pick list
  const ordersWithoutPickList = (ordersData || []).filter(
    (order) => !allPickListOrderIds.has(order.id)
  );

  const pickListIds = (pickListData || []).map((pl) => pl.id);
  const pickListOrderIds = (pickListData || []).map((pl) => pl.order_id);
  const orderWithoutPickListIds = ordersWithoutPickList.map((o) => o.id);
  const allOrderIds = [...pickListOrderIds, ...orderWithoutPickListIds];
  
  const [aggregateData, orderItemsMap] = await Promise.all([
    aggregatePickListData(supabase, pickListIds),
    fetchOrderItems(supabase, allOrderIds),
  ]);
  
  const { itemCountsMap, feedbackCountsMap } = aggregateData;

  // Map pick lists to tasks
  const pickListTasks = (pickListData || [])
    .filter((pl) => pl.orders)
    .map((pl) => mapToPickerTask(pl as unknown as PickListQueryRow, itemCountsMap, feedbackCountsMap, orderItemsMap));

  // Map orders without pick lists to tasks (these need pick lists created when started)
  const orderTasks: PickerTask[] = (ordersWithoutPickList || []).map((order): PickerTask => {
    const customerData = order.customers as { name: string } | { name: string }[] | null;
    const customer = asSingle(customerData);
    return {
      id: `order-${order.id}`, // Prefix to indicate this is an order without pick list
      orgId: orgId,
      orderId: order.id,
      assignedUserId: undefined,
      assignedTeamId: undefined,
      sequence: 999, // Put at end of sequence since no explicit sequence
      status: "pending",
      qcStatus: undefined,
      isPartial: false,
      mergeStatus: undefined,
      startedAt: undefined,
      completedAt: undefined,
      notes: undefined,
      createdAt: new Date().toISOString(),
      orderNumber: order.order_number || "Unknown",
      orderStatus: order.status || "unknown",
      requestedDeliveryDate: order.requested_delivery_date || undefined,
      customerName: customer?.name || "Unknown Customer",
      totalItems: 0,
      pickedItems: 0,
      totalQty: 0,
      pickedQty: 0,
      pendingFeedbackCount: 0,
      unacknowledgedFeedbackCount: 0,
      items: orderItemsMap.get(order.id) || [],
    };
  });

  return sortByDeliveryDate([...pickListTasks, ...orderTasks]);
}

/**
 * Get combined picker tasks (personal + available unassigned)
 * All sorted by delivery date for priority
 */
export async function getAllPickerTasks(): Promise<{
  myTasks: PickerTask[];
  availableTasks: PickerTask[];
}> {
  const [myTasks, availableTasks] = await Promise.all([
    getPickerTasks(),
    getUnassignedPickerTasks(),
  ]);

  return { myTasks, availableTasks };
}
