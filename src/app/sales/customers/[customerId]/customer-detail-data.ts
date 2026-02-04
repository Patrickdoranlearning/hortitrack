import type { SupabaseClient } from "@supabase/supabase-js";
import { getISOWeek, getYear } from "date-fns";
import type { CustomerOrder, FavouriteProduct, LastOrderWeek, CustomerStats, CustomerInteraction, ExtendedCustomerStats } from "./types";
import { differenceInDays, subMonths, format, startOfMonth } from "date-fns";
import type { CustomerSummary } from "../types";

/**
 * Fetch customer details with all related data
 * Note: RLS policies handle org-level access control
 */
export async function fetchCustomerDetail(
  supabase: SupabaseClient,
  customerId: string
): Promise<CustomerSummary | null> {
  const { data: customer, error } = await supabase
    .from("customers")
    .select(`
      id,
      name,
      code,
      email,
      phone,
      vat_number,
      notes,
      default_price_list_id,
      currency,
      country_code,
      payment_terms_days,
      credit_limit,
      account_code,
      store,
      accounts_email,
      pricing_tier,
      created_at,
      requires_pre_pricing,
      pre_pricing_foc,
      pre_pricing_cost_per_label,
      customer_addresses (
        id,
        label,
        store_name,
        line1,
        line2,
        city,
        county,
        eircode,
        country_code,
        is_default_shipping,
        is_default_billing,
        contact_name,
        contact_email,
        contact_phone
      ),
      customer_contacts (
        id,
        name,
        email,
        phone,
        mobile,
        role,
        is_primary
      )
    `)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching customer:", error.message, error.code, error.details);
    return null;
  }

  if (!customer) {
    console.error("Customer not found:", customerId);
    return null;
  }

  // Fetch default price list name separately if set
  let defaultPriceListName: string | null = null;
  if (customer.default_price_list_id) {
    const { data: priceList } = await supabase
      .from("price_lists")
      .select("name")
      .eq("id", customer.default_price_list_id)
      .maybeSingle();
    defaultPriceListName = priceList?.name ?? null;
  }

  // Fetch price list assignments separately
  const { data: priceListCustomers } = await supabase
    .from("price_list_customers")
    .select("id, price_list_id, valid_from, valid_to")
    .eq("customer_id", customerId);

  // Fetch price list names for assignments
  const priceListIds = (priceListCustomers ?? [])
    .map((plc: any) => plc.price_list_id)
    .filter(Boolean);

  const priceListNames: Record<string, string> = {};
  if (priceListIds.length > 0) {
    const { data: priceLists } = await supabase
      .from("price_lists")
      .select("id, name")
      .in("id", priceListIds);

    (priceLists ?? []).forEach((pl: any) => {
      priceListNames[pl.id] = pl.name;
    });
  }

  // Map to CustomerSummary type
  return {
    id: customer.id,
    name: customer.name,
    code: customer.code,
    email: customer.email,
    phone: customer.phone,
    vatNumber: customer.vat_number,
    notes: customer.notes,
    defaultPriceListId: customer.default_price_list_id,
    defaultPriceListName,
    currency: customer.currency ?? "EUR",
    countryCode: customer.country_code ?? "IE",
    paymentTermsDays: customer.payment_terms_days ?? 30,
    creditLimit: customer.credit_limit,
    accountCode: customer.account_code,
    store: customer.store,
    accountsEmail: customer.accounts_email,
    pricingTier: customer.pricing_tier,
    deliveryPreferences: null,
    createdAt: customer.created_at,
    addresses: ((customer.customer_addresses as any[]) ?? []).map((addr: any) => ({
      id: addr.id,
      label: addr.label,
      storeName: addr.store_name,
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      county: addr.county,
      eircode: addr.eircode,
      countryCode: addr.country_code ?? "IE",
      isDefaultShipping: addr.is_default_shipping ?? false,
      isDefaultBilling: addr.is_default_billing ?? false,
      contactName: addr.contact_name,
      contactEmail: addr.contact_email,
      contactPhone: addr.contact_phone,
    })),
    contacts: ((customer.customer_contacts as any[]) ?? []).map((contact: any) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      role: contact.role,
      isPrimary: contact.is_primary ?? false,
    })),
    priceListAssignments: (priceListCustomers ?? []).map((plc: any) => ({
      id: plc.id,
      priceListId: plc.price_list_id,
      priceListName: priceListNames[plc.price_list_id] ?? "Unknown",
      validFrom: plc.valid_from,
      validTo: plc.valid_to,
    })),
    orderCount: 0, // Will be computed separately
    aliasCount: 0, // Will be computed separately
    requiresPrePricing: customer.requires_pre_pricing ?? false,
    prePricingFoc: customer.pre_pricing_foc ?? false,
    prePricingCostPerLabel: customer.pre_pricing_cost_per_label ?? null,
  };
}

/**
 * Fetch all orders for a customer
 */
export async function fetchCustomerOrders(
  supabase: SupabaseClient,
  customerId: string
): Promise<CustomerOrder[]> {
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
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer orders:", error);
    return [];
  }

  // Fetch item counts for each order
  const orderIds = orders?.map((o) => o.id) ?? [];
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

  return (orders ?? []).map((order) => ({
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
 * Fetch favourite products for a customer (aggregated from order history)
 */
export async function fetchFavouriteProducts(
  supabase: SupabaseClient,
  customerId: string
): Promise<FavouriteProduct[]> {
  // First get all order IDs for this customer (excluding cancelled/draft)
  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at")
    .eq("customer_id", customerId)
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
  const { data: items } = await supabase
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
    .slice(0, 20); // Top 20 products
}

/**
 * Compute last order week from orders
 */
export function computeLastOrderWeek(orders: CustomerOrder[]): LastOrderWeek {
  if (orders.length === 0) return null;

  // Orders are already sorted by date descending, so first one is most recent
  const mostRecentOrder = orders[0];
  const orderDate = new Date(mostRecentOrder.createdAt);

  return {
    week: getISOWeek(orderDate),
    year: getYear(orderDate),
  };
}

/**
 * Compute customer statistics from orders
 */
export function computeCustomerStats(orders: CustomerOrder[]): CustomerStats {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalIncVat, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue,
  };
}

/**
 * Compute extended customer statistics including order patterns
 */
export function computeExtendedCustomerStats(orders: CustomerOrder[]): ExtendedCustomerStats {
  const baseStats = computeCustomerStats(orders);
  const now = new Date();

  // Days since last order
  let daysSinceLastOrder: number | null = null;
  if (orders.length > 0) {
    const lastOrderDate = new Date(orders[0].createdAt);
    daysSinceLastOrder = differenceInDays(now, lastOrderDate);
  }

  // Average days between orders
  let averageDaysBetweenOrders: number | null = null;
  if (orders.length >= 2) {
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let totalDays = 0;
    for (let i = 1; i < sortedOrders.length; i++) {
      const daysBetween = differenceInDays(
        new Date(sortedOrders[i].createdAt),
        new Date(sortedOrders[i - 1].createdAt)
      );
      totalDays += daysBetween;
    }
    averageDaysBetweenOrders = Math.round(totalDays / (sortedOrders.length - 1));
  }

  // Orders in last 12 months
  const twelveMonthsAgo = subMonths(now, 12);
  const ordersLast12Months = orders.filter(
    (o) => new Date(o.createdAt) >= twelveMonthsAgo
  ).length;

  // Orders by month (last 12 months)
  const ordersByMonth: Array<{ month: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthLabel = format(monthStart, 'MMM');
    const monthOrders = orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      const orderMonth = startOfMonth(orderDate);
      return orderMonth.getTime() === monthStart.getTime();
    });
    ordersByMonth.push({ month: monthLabel, count: monthOrders.length });
  }

  // Health status
  let healthStatus: 'active' | 'at_risk' | 'churning' | 'new';
  if (orders.length === 0) {
    healthStatus = 'new';
  } else if (daysSinceLastOrder !== null) {
    if (daysSinceLastOrder <= 42) {
      // 6 weeks
      healthStatus = 'active';
    } else if (daysSinceLastOrder <= 84) {
      // 12 weeks
      healthStatus = 'at_risk';
    } else {
      healthStatus = 'churning';
    }
  } else {
    healthStatus = 'new';
  }

  return {
    ...baseStats,
    averageDaysBetweenOrders,
    ordersLast12Months,
    ordersByMonth,
    daysSinceLastOrder,
    healthStatus,
  };
}

/**
 * Fetch customer interactions with user display names
 * Returns interactions sorted by created_at DESC with pagination support
 */
export async function fetchCustomerInteractions(
  supabase: SupabaseClient,
  customerId: string,
  limit = 50,
  offset = 0
): Promise<{ interactions: CustomerInteraction[]; hasMore: boolean }> {
  const { data: interactions, error } = await supabase
    .from("customer_interactions")
    .select(`
      id,
      type,
      notes,
      outcome,
      created_at,
      user_id,
      profiles:user_id (
        display_name,
        email
      )
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    console.error("Error fetching customer interactions:", error.message);
    return { interactions: [], hasMore: false };
  }

  const mapped: CustomerInteraction[] = (interactions ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    notes: row.notes,
    outcome: row.outcome,
    createdAt: row.created_at,
    userId: row.user_id,
    userName: row.profiles?.display_name ?? null,
    userEmail: row.profiles?.email ?? null,
  }));

  return {
    interactions: mapped,
    hasMore: mapped.length > limit,
  };
}
