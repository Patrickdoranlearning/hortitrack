import "server-only";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Batch } from "@/lib/types";
import type { Database } from "@/types/supabase";
import { logError, logWarning } from "@/lib/log";

// Type helpers for database queries
type OrderRow = Database['public']['Tables']['orders']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerAddressRow = Database['public']['Tables']['customer_addresses']['Row'];

// Query result type with joined relations
interface OrderWithRelations extends OrderRow {
  customers?: Pick<CustomerRow, 'name'> | null;
  customer_addresses?: Pick<CustomerAddressRow, 'county' | 'city'> | null;
}

interface OrderLine {
  id: string;
  plantVariety: string;
  size: string;
  qty: number | null;
  unitPrice: number | null;
}

export const OrderSchema = z.object({
  id: z.string(),
  customerName: z.string().min(1).default(""),
  customerId: z.string().optional(),
  // Order status enum from database: draft, confirmed, picking, ready, packed, dispatched, delivered, cancelled, void
  status: z.enum(["draft", "confirmed", "picking", "ready", "packed", "dispatched", "delivered", "cancelled", "void"]),
  createdAt: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

export const NewOrderSchema = z.object({
  customerId: z.string().min(1),
  status: z.enum(["draft", "confirmed"]).default("draft"),
});
export type NewOrder = z.infer<typeof NewOrderSchema>;

export async function listOrders(params: {
  page?: number;
  pageSize?: number;
  status?: string | string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<{
  orders: Array<Order & {
    org_id: string;
    order_number: string;
    total_inc_vat: number | null;
    requested_delivery_date: string | null;
    customer?: { name: string | null } | null;
    ship_to_address?: { county: string | null; city: string | null } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const { supabase, orgId } = await getUserAndOrg();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(params.pageSize ?? 20, 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Determine sort column and order
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';
  const ascending = sortOrder === 'asc';

  // Removed count: "exact" for performance - use estimated count or cursor pagination instead
  let query = supabase
    .from("orders")
    .select("*, customers(name), customer_addresses!orders_ship_to_address_id_fkey(county, city)", { count: "estimated" })
    .eq("org_id", orgId)
    .order(sortBy, { ascending })
    .range(from, to);

  // Support both single status string and array of statuses
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in("status", statuses);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    logError("Error listing orders", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { orders: [], total: 0, page, pageSize };
  }

  const mapped = (data || []).map((d: OrderWithRelations) => ({
    id: d.id,
    org_id: d.org_id,
    order_number: d.order_number,
    customer_id: d.customer_id,
    status: d.status,
    createdAt: d.created_at,
    created_at: d.created_at,
    updated_at: d.updated_at,
    requested_delivery_date: d.requested_delivery_date,
    subtotal_ex_vat: d.subtotal_ex_vat ?? null,
    vat_amount: d.vat_amount ?? null,
    total_inc_vat: d.total_inc_vat ?? null,
    notes: d.notes ?? null,
    customerName: d.customers?.name || "Unknown",
    customer: d.customers ? { name: d.customers.name } : null,
    ship_to_address: d.customer_addresses ? {
      county: d.customer_addresses.county,
      city: d.customer_addresses.city
    } : null,
  }));

  return { orders: mapped, total: count ?? mapped.length, page, pageSize };
}

export async function createOrder(input: NewOrder): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get active org
  let activeOrgId: string | null = null;
  const { data: profile } = await supabase.from('profiles').select('active_org_id').eq('id', user.id).single();
  if (profile?.active_org_id) {
    activeOrgId = profile.active_org_id;
  } else {
    const { data: membership } = await supabase.from('org_memberships').select('org_id').eq('user_id', user.id).limit(1).single();
    if (membership) activeOrgId = membership.org_id;
  }
  if (!activeOrgId) throw new Error("No active organization found");

  const { data, error } = await supabase
    .from("orders")
    .insert({
      org_id: activeOrgId,
      customer_id: input.customerId,
      order_number: `ORD-${Date.now()}`, // Simple generation for now
      status: input.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}
export async function getOrderById(orderId: string): Promise<Order & { lines: OrderLine[] } | null> {
  const { supabase, orgId } = await getUserAndOrg();
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, customers(name)")
    .eq("id", orderId)
    .eq("org_id", orgId)
    .single();

  if (orderErr || !order) return null;

  const { data: lines } = await supabase
    .from("order_items")
    .select("*, skus(plant_varieties(name), plant_sizes(name))")
    .eq("order_id", orderId);

  const mappedLines = (lines || []).map((l: any) => ({
    id: l.id,
    plantVariety: l.skus?.plant_varieties?.name ?? "Unknown",
    size: l.skus?.plant_sizes?.name ?? "Unknown",
    qty: l.quantity,
    unitPrice: l.unit_price_ex_vat,
  }));

  return {
    ...OrderSchema.parse({
      id: order.id,
      customerId: order.customer_id,
      status: order.status,
      createdAt: order.created_at,
      customerName: order.customers?.name ?? "Unknown"
    }),
    lines: mappedLines
  };
}


export async function getCustomers(): Promise<CustomerRow[]> {
  const { supabase, orgId } = await getUserAndOrg();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  if (error) {
    logError("Error fetching customers", {
      message: error.message,
      code: error.code,
    });
    return [];
  }
  return data ?? [];
}

export interface SaleableProduct {
  id: string;
  plantVariety: string;
  size: string;
  category?: string;
  totalQuantity: number;
  barcode?: string;
  cost?: number;
  status?: string;
  imageUrl?: string;
  availableBatches: Batch[];
}

import { getSaleableBatches } from "@/server/sales/inventory";
import { getUserAndOrg } from "@/server/auth/org";

/**
 * Get saleable products with aggregated availability
 * Uses SQL RPC for aggregation when available, falls back to JS aggregation
 */
export async function getSaleableProducts(): Promise<SaleableProduct[]> {
  const { supabase, orgId } = await getUserAndOrg();

  // Try optimized SQL aggregation first
  const { data: aggregatedData, error: rpcError } = await supabase.rpc(
    "get_product_availability",
    { p_org_id: orgId }
  );

  if (!rpcError && aggregatedData) {
    // Use SQL-aggregated data (much faster for large datasets)
    return (aggregatedData || []).map((row: any) => ({
      id: row.product_key,
      plantVariety: row.plant_variety,
      size: row.size,
      totalQuantity: Number(row.available_quantity),
      barcode: `BARCODE-${row.plant_variety?.replace(/\s+/g, "")}`,
      cost: 1.53,
      status: "Bud & flower",
      imageUrl: row.sample_image_url || `https://placehold.co/100x100.png`,
      availableBatches: [], // Batches not loaded in aggregated view for performance
    }));
  }

  // Fallback to JS aggregation if RPC not available
  logWarning("get_product_availability RPC not available, using fallback", {});
  return getSaleableProductsFallback();
}

/**
 * Fallback implementation using in-memory aggregation
 * Used when SQL RPC is not yet deployed
 */
async function getSaleableProductsFallback(): Promise<SaleableProduct[]> {
  const batches = await getSaleableBatches();

  const productsMap = new Map<string, SaleableProduct>();

  batches.forEach((b) => {
    // Create a minimal batch-like object for aggregation
    // Using Partial<Batch> since we only have limited data from getSaleableBatches
    const batch: Partial<Batch> & { id: string; plantVariety?: string; size?: string; quantity?: number; category?: string; growerPhotoUrl?: string; salesPhotoUrl?: string; status?: string } = {
      id: b.id,
      orgId: "",
      batchNumber: b.batchNumber || "",
      plantVariety: b.plantVariety || "",
      size: b.size || "",
      category: b.category,
      quantity: b.quantity || 0,
      growerPhotoUrl: b.growerPhotoUrl,
      salesPhotoUrl: b.salesPhotoUrl,
      status: b.status,
      plantVarietyId: "",
      sizeId: "",
      locationId: "",
      phase: "finished",
      reservedQuantity: 0,
      unit: "each",
      logHistory: [],
      supplierBatchNumber: "",
    };

    const productKey = `${batch.plantVariety}-${batch.size}`;

    if (productsMap.has(productKey)) {
      const existingProduct = productsMap.get(productKey)!;
      existingProduct.totalQuantity += batch.quantity ?? 0;
      existingProduct.availableBatches.push(batch as Batch);
    } else {
      productsMap.set(productKey, {
        id: productKey,
        plantVariety: batch.plantVariety ?? "",
        size: batch.size ?? "",
        category: batch.category,
        totalQuantity: batch.quantity ?? 0,
        barcode: `BARCODE-${batch.plantVariety?.replace(/\s+/g, "")}`,
        cost: 1.53,
        status: "Bud & flower",
        imageUrl:
          batch.growerPhotoUrl ||
          batch.salesPhotoUrl ||
          `https://placehold.co/100x100.png`,
        availableBatches: [batch as Batch],
      });
    }
  });

  return Array.from(productsMap.values());
}
