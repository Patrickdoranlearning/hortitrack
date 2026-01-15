import "server-only";
import { getUserAndOrg } from "@/server/auth/org";

// ================================================
// TYPES
// ================================================

export type TrolleyBalance = {
  customerId: string;
  customerName: string;
  orgId: string;
  trolleysOut: number;
  shelvesOut: number;
  lastDeliveryDate: string | null;
  lastReturnDate: string | null;
  daysOutstanding: number | null;
  updatedAt: string;
};

export type TrolleyMovement = {
  id: string;
  movementDate: string;
  movementType: "delivered" | "returned" | "not_returned" | "adjustment";
  customerId: string;
  customerName: string;
  trolleys: number;
  shelves: number;
  deliveryRunId: string | null;
  deliveryRunNumber: string | null;
  driverName: string | null;
  notes: string | null;
  signedDocketUrl: string | null;
  recordedBy: string | null;
};

export type TrolleyMovementInput = {
  type: "delivered" | "returned" | "not_returned" | "adjustment";
  customerId: string;
  trolleys: number;
  shelves?: number;
  notes?: string;
  deliveryRunId?: string;
  signedDocketUrl?: string;
};

export type TrolleyReconciliation = {
  orderId: string;
  orderNumber: string;
  estimated: number | null;
  actual: number | null;
  variance: number | null;
  variancePercent: number | null;
};

// ================================================
// BALANCE QUERIES
// ================================================

/**
 * Get trolley balance for a specific customer
 */
export async function getCustomerTrolleyBalance(
  customerId: string
): Promise<TrolleyBalance | null> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("customer_trolley_balance")
    .select(
      `
      customer_id,
      trolleys_out,
      shelves_out,
      last_delivery_date,
      last_return_date,
      updated_at,
      customers (
        id,
        name
      )
    `
    )
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .single();

  if (error || !data) {
    // Return zero balance if no record exists
    // First get customer name
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .single();

    return {
      customerId,
      customerName: customer?.name || "Unknown",
      orgId,
      trolleysOut: 0,
      shelvesOut: 0,
      lastDeliveryDate: null,
      lastReturnDate: null,
      daysOutstanding: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const lastDeliveryDate = data.last_delivery_date
    ? new Date(data.last_delivery_date)
    : null;
  const daysOutstanding = lastDeliveryDate
    ? Math.floor(
        (Date.now() - lastDeliveryDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return {
    customerId: data.customer_id,
    customerName: (data.customers as any)?.name || "Unknown",
    orgId,
    trolleysOut: data.trolleys_out || 0,
    shelvesOut: data.shelves_out || 0,
    lastDeliveryDate: data.last_delivery_date,
    lastReturnDate: data.last_return_date,
    daysOutstanding,
    updatedAt: data.updated_at,
  };
}

/**
 * Get all customers with outstanding trolley balances
 */
export async function getAllTrolleyBalances(): Promise<TrolleyBalance[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("customer_trolley_balance")
    .select(
      `
      customer_id,
      trolleys_out,
      shelves_out,
      last_delivery_date,
      last_return_date,
      updated_at,
      customers (
        id,
        name
      )
    `
    )
    .eq("org_id", orgId)
    .gt("trolleys_out", 0)
    .order("trolleys_out", { ascending: false });

  if (error) {
    console.error("Error fetching trolley balances:", error);
    return [];
  }

  return (data || []).map((row: any) => {
    const lastDeliveryDate = row.last_delivery_date
      ? new Date(row.last_delivery_date)
      : null;
    const daysOutstanding = lastDeliveryDate
      ? Math.floor(
          (Date.now() - lastDeliveryDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      customerId: row.customer_id,
      customerName: row.customers?.name || "Unknown",
      orgId,
      trolleysOut: row.trolleys_out || 0,
      shelvesOut: row.shelves_out || 0,
      lastDeliveryDate: row.last_delivery_date,
      lastReturnDate: row.last_return_date,
      daysOutstanding,
      updatedAt: row.updated_at,
    };
  });
}

// ================================================
// MOVEMENT LOG
// ================================================

/**
 * Record a trolley movement (delivery, return, adjustment)
 * The database trigger will automatically update customer_trolley_balance
 */
export async function recordTrolleyMovement(
  input: TrolleyMovementInput
): Promise<{ success: boolean; movementId?: string; error?: string }> {
  const { orgId, userId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("equipment_movement_log")
    .insert({
      org_id: orgId,
      movement_type: input.type,
      customer_id: input.customerId,
      trolleys: input.trolleys,
      shelves: input.shelves || 0,
      notes: input.notes || null,
      delivery_run_id: input.deliveryRunId || null,
      signed_docket_url: input.signedDocketUrl || null,
      recorded_by: userId,
      movement_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error recording trolley movement:", error);
    return { success: false, error: error.message };
  }

  return { success: true, movementId: data?.id };
}

/**
 * Get trolley movement history for a customer
 */
export async function getCustomerTrolleyHistory(
  customerId: string,
  limit: number = 50
): Promise<TrolleyMovement[]> {
  const { orgId, supabase } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("equipment_movement_log")
    .select(
      `
      id,
      movement_date,
      movement_type,
      customer_id,
      trolleys,
      shelves,
      delivery_run_id,
      notes,
      signed_docket_url,
      recorded_by,
      customers (
        id,
        name
      ),
      delivery_runs (
        id,
        run_number,
        driver_name
      )
    `
    )
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("movement_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching trolley history:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    movementDate: row.movement_date,
    movementType: row.movement_type,
    customerId: row.customer_id,
    customerName: row.customers?.name || "Unknown",
    trolleys: row.trolleys,
    shelves: row.shelves,
    deliveryRunId: row.delivery_run_id,
    deliveryRunNumber: row.delivery_runs?.run_number || null,
    driverName: row.delivery_runs?.driver_name || null,
    notes: row.notes,
    signedDocketUrl: row.signed_docket_url,
    recordedBy: row.recorded_by,
  }));
}

// ================================================
// RECONCILIATION
// ================================================

/**
 * Get trolley reconciliation data for an order
 * Compares estimated trolleys (from order) with actual (from pick list)
 */
export async function getOrderTrolleyReconciliation(
  orderId: string
): Promise<TrolleyReconciliation | null> {
  const { orgId, supabase } = await getUserAndOrg();

  // Get order with estimated trolleys and linked pick list
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      trolleys_estimated,
      pick_lists (
        id,
        trolleys_used
      )
    `
    )
    .eq("id", orderId)
    .eq("org_id", orgId)
    .single();

  if (orderError || !order) {
    return null;
  }

  const estimated = order.trolleys_estimated;
  // pick_lists is an array, get the first one (usually only one per order)
  const pickList = Array.isArray(order.pick_lists)
    ? order.pick_lists[0]
    : order.pick_lists;
  const actual = pickList?.trolleys_used ?? null;

  let variance: number | null = null;
  let variancePercent: number | null = null;

  if (estimated !== null && actual !== null) {
    variance = actual - estimated;
    variancePercent =
      estimated > 0 ? Math.round((variance / estimated) * 100) : null;
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    estimated,
    actual,
    variance,
    variancePercent,
  };
}

/**
 * Get aggregated trolley stats for dashboard
 */
export async function getTrolleyDashboardStats(): Promise<{
  totalOutstanding: number;
  customersWithTrolleys: number;
  overdueCount: number;
  recentDeliveries: number;
  recentReturns: number;
}> {
  const { orgId, supabase } = await getUserAndOrg();

  // Get aggregate stats from customer_trolley_balance
  const { data: balanceStats, error: balanceError } = await supabase
    .from("customer_trolley_balance")
    .select("trolleys_out, last_delivery_date")
    .eq("org_id", orgId)
    .gt("trolleys_out", 0);

  if (balanceError) {
    console.error("Error fetching balance stats:", balanceError);
    return {
      totalOutstanding: 0,
      customersWithTrolleys: 0,
      overdueCount: 0,
      recentDeliveries: 0,
      recentReturns: 0,
    };
  }

  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  let totalOutstanding = 0;
  let overdueCount = 0;

  for (const row of balanceStats || []) {
    totalOutstanding += row.trolleys_out || 0;
    if (row.last_delivery_date) {
      const deliveryDate = new Date(row.last_delivery_date).getTime();
      if (deliveryDate < fourteenDaysAgo) {
        overdueCount++;
      }
    }
  }

  // Get recent movements from the last 7 days
  const { data: recentMovements, error: movementError } = await supabase
    .from("equipment_movement_log")
    .select("movement_type, trolleys")
    .eq("org_id", orgId)
    .gte("movement_date", new Date(sevenDaysAgo).toISOString());

  let recentDeliveries = 0;
  let recentReturns = 0;

  if (!movementError && recentMovements) {
    for (const m of recentMovements) {
      if (m.movement_type === "delivered") {
        recentDeliveries += m.trolleys || 0;
      } else if (m.movement_type === "returned") {
        recentReturns += m.trolleys || 0;
      }
    }
  }

  return {
    totalOutstanding,
    customersWithTrolleys: balanceStats?.length || 0,
    overdueCount,
    recentDeliveries,
    recentReturns,
  };
}
