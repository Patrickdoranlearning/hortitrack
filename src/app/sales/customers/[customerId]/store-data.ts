import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreWithMetrics, StoreOrder, StoreTopProduct, StorePreferences, StoreOrderFrequency, StoreWithMetricsAndPreferences } from "./types";
import { subMonths, format, differenceInDays, parseISO } from "date-fns";

/**
 * Fetch all stores (addresses) for a customer with order metrics from the v_store_order_metrics view.
 * Returns stores sorted by order count (most active first), with stores having 0 orders at the end.
 */
export async function fetchStoreListWithMetrics(
  supabase: SupabaseClient,
  customerId: string
): Promise<StoreWithMetricsAndPreferences[]> {
  // Fetch metrics from view
  const { data: metricsData, error: metricsError } = await supabase
    .from("v_store_order_metrics")
    .select("*")
    .eq("customer_id", customerId)
    .order("order_count", { ascending: false });

  if (metricsError) {
    console.error("Error fetching store metrics:", metricsError.message, metricsError.code);
    return [];
  }

  if (!metricsData || metricsData.length === 0) {
    return [];
  }

  // Fetch preferences for all addresses
  const addressIds = metricsData.map((row: any) => row.address_id);
  const { data: addressData } = await supabase
    .from("customer_addresses")
    .select("id, preferences")
    .in("id", addressIds);

  const preferencesMap: Record<string, StorePreferences> = {};
  if (addressData) {
    addressData.forEach((addr: any) => {
      preferencesMap[addr.id] = (addr.preferences as StorePreferences) || {};
    });
  }

  return metricsData.map((row: any) => ({
    addressId: row.address_id,
    customerId: row.customer_id,
    label: row.label,
    storeName: row.store_name,
    city: row.city,
    county: row.county,
    orderCount: row.order_count ?? 0,
    totalRevenue: parseFloat(row.total_revenue) || 0,
    avgOrderValue: parseFloat(row.avg_order_value) || 0,
    lastOrderAt: row.last_order_at,
    preferences: preferencesMap[row.address_id] || {},
  }));
}

/**
 * Fetch orders for a specific store (address) filtered by ship_to_address_id.
 * Returns orders sorted by created_at descending.
 */
export async function fetchStoreOrders(
  supabase: SupabaseClient,
  addressId: string,
  limit: number = 50
): Promise<StoreOrder[]> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      requested_delivery_date,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat
    `)
    .eq("ship_to_address_id", addressId)
    .not("status", "in", '("cancelled","draft")')
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching store orders:", error.message, error.code);
    return [];
  }

  if (!orders || orders.length === 0) {
    return [];
  }

  // Fetch item counts for each order
  const orderIds = orders.map((o) => o.id);
  const itemCounts: Record<string, number> = {};

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id")
      .in("order_id", orderIds);

    if (items) {
      items.forEach((item: { order_id: string }) => {
        itemCounts[item.order_id] = (itemCounts[item.order_id] || 0) + 1;
      });
    }
  }

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    requestedDeliveryDate: order.requested_delivery_date,
    subtotalExVat: order.subtotal_ex_vat ?? 0,
    vatAmount: order.vat_amount ?? 0,
    totalIncVat: order.total_inc_vat ?? 0,
    itemCount: itemCounts[order.id] ?? 0,
  }));
}

/**
 * Fetch top products for a specific store aggregated from order_items.
 * Products are ranked by total quantity ordered at this store.
 */
export async function fetchStoreTopProducts(
  supabase: SupabaseClient,
  addressId: string,
  limit: number = 10
): Promise<StoreTopProduct[]> {
  // First get all order IDs for this address (excluding cancelled/draft)
  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at")
    .eq("ship_to_address_id", addressId)
    .not("status", "in", '("cancelled","draft")');

  if (!orders || orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);
  const orderDates: Record<string, string> = {};
  orders.forEach((o) => {
    orderDates[o.id] = o.created_at;
  });

  // Fetch all order items for these orders with SKU details
  const { data: items, error } = await supabase
    .from("order_items")
    .select(`
      order_id,
      sku_id,
      quantity,
      line_total_ex_vat,
      skus (
        id,
        display_name,
        plant_varieties (name),
        plant_sizes (name)
      )
    `)
    .in("order_id", orderIds);

  if (error) {
    console.error("Error fetching store products:", error.message, error.code);
    return [];
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Aggregate by SKU
  const productMap = new Map<string, {
    skuId: string;
    productName: string;
    varietyName: string | null;
    sizeName: string | null;
    totalQuantity: number;
    totalRevenue: number;
    orderIds: Set<string>;
    lastOrderDate: string;
  }>();

  items.forEach((item: any) => {
    const sku = item.skus;
    if (!sku) return;

    const skuId = sku.id;
    const varietyName = sku.plant_varieties?.name ?? null;
    const sizeName = sku.plant_sizes?.name ?? null;
    const productName = sku.display_name ||
      [varietyName, sizeName].filter(Boolean).join(" - ") ||
      "Unknown Product";

    const existing = productMap.get(skuId);
    const orderDate = orderDates[item.order_id] || "";

    if (existing) {
      existing.totalQuantity += item.quantity || 0;
      existing.totalRevenue += item.line_total_ex_vat || 0;
      existing.orderIds.add(item.order_id);
      if (orderDate > existing.lastOrderDate) {
        existing.lastOrderDate = orderDate;
      }
    } else {
      productMap.set(skuId, {
        skuId,
        productName,
        varietyName,
        sizeName,
        totalQuantity: item.quantity || 0,
        totalRevenue: item.line_total_ex_vat || 0,
        orderIds: new Set([item.order_id]),
        lastOrderDate: orderDate,
      });
    }
  });

  // Convert to array and sort by quantity
  return Array.from(productMap.values())
    .map((p) => ({
      skuId: p.skuId,
      productName: p.productName,
      varietyName: p.varietyName,
      sizeName: p.sizeName,
      totalQuantity: p.totalQuantity,
      totalRevenue: p.totalRevenue,
      orderCount: p.orderIds.size,
      lastOrderDate: p.lastOrderDate,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit);
}

/**
 * Fetch store details with preferences for a specific address.
 */
export async function fetchStoreWithPreferences(
  supabase: SupabaseClient,
  addressId: string
): Promise<StoreWithMetricsAndPreferences | null> {
  // Fetch address with preferences
  const { data: address, error: addrError } = await supabase
    .from("customer_addresses")
    .select("id, customer_id, label, store_name, city, county, preferences")
    .eq("id", addressId)
    .single();

  if (addrError || !address) {
    console.error("Error fetching address:", addrError?.message);
    return null;
  }

  // Fetch metrics from view
  const { data: metrics } = await supabase
    .from("v_store_order_metrics")
    .select("*")
    .eq("address_id", addressId)
    .single();

  return {
    addressId: address.id,
    customerId: address.customer_id,
    label: address.label,
    storeName: address.store_name,
    city: address.city,
    county: address.county,
    orderCount: metrics?.order_count ?? 0,
    totalRevenue: parseFloat(metrics?.total_revenue) || 0,
    avgOrderValue: parseFloat(metrics?.avg_order_value) || 0,
    lastOrderAt: metrics?.last_order_at,
    preferences: (address.preferences as StorePreferences) || {},
  };
}

/**
 * Fetch order frequency data for a specific store (last 12 months).
 */
export async function fetchStoreOrderFrequency(
  supabase: SupabaseClient,
  addressId: string
): Promise<StoreOrderFrequency> {
  const now = new Date();
  const twelveMonthsAgo = subMonths(now, 12);

  // Fetch orders for this address in the last 12 months
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, created_at")
    .eq("ship_to_address_id", addressId)
    .not("status", "in", '("cancelled","draft")')
    .gte("created_at", twelveMonthsAgo.toISOString())
    .order("created_at", { ascending: true });

  if (error || !orders) {
    console.error("Error fetching store order frequency:", error?.message);
    return {
      ordersByMonth: generateEmptyMonths(),
      ordersLast12Months: 0,
      averageDaysBetweenOrders: null,
    };
  }

  // Group by month
  const ordersByMonth = generateEmptyMonths();
  const monthIndex: Record<string, number> = {};
  ordersByMonth.forEach((m, i) => {
    monthIndex[m.month] = i;
  });

  orders.forEach((order) => {
    const monthKey = format(parseISO(order.created_at), "MMM");
    if (monthIndex[monthKey] !== undefined) {
      ordersByMonth[monthIndex[monthKey]].count++;
    }
  });

  // Calculate average days between orders
  let averageDaysBetweenOrders: number | null = null;
  if (orders.length >= 2) {
    const sortedDates = orders.map((o) => parseISO(o.created_at)).sort((a, b) => a.getTime() - b.getTime());
    let totalDays = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      totalDays += differenceInDays(sortedDates[i], sortedDates[i - 1]);
    }
    averageDaysBetweenOrders = Math.round(totalDays / (sortedDates.length - 1));
  }

  return {
    ordersByMonth,
    ordersLast12Months: orders.length,
    averageDaysBetweenOrders,
  };
}

/**
 * Update store preferences for an address.
 */
export async function updateStorePreferences(
  supabase: SupabaseClient,
  addressId: string,
  preferences: StorePreferences
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("customer_addresses")
    .update({ preferences })
    .eq("id", addressId);

  if (error) {
    console.error("Error updating store preferences:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Generate empty months array for the last 12 months.
 */
function generateEmptyMonths(): Array<{ month: string; count: number }> {
  const months: Array<{ month: string; count: number }> = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = subMonths(now, i);
    months.push({
      month: format(date, "MMM"),
      count: 0,
    });
  }

  return months;
}
