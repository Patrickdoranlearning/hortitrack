import "server-only";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Supplier, Batch } from "@/lib/types";

export const OrderSchema = z.object({
  id: z.string(),
  customerName: z.string().min(1).default(""),
  customerId: z.string().optional(),
  status: z.enum(["draft", "confirmed", "processing", "ready_for_dispatch", "dispatched", "delivered", "cancelled"]),
  createdAt: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

export const NewOrderSchema = z.object({
  customerId: z.string().min(1),
  status: z.enum(["draft", "confirmed"]).default("draft"),
});
export type NewOrder = z.infer<typeof NewOrderSchema>;

export async function listOrders(params: { page?: number; pageSize?: number; status?: string } = {}): Promise<{
  orders: Array<Order & { org_id: string; order_number: string; total_inc_vat: number | null; requested_delivery_date: string | null; customer?: { name: string | null } | null }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(params.pageSize ?? 20, 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Removed count: "exact" for performance - use estimated count or cursor pagination instead
  let query = supabase
    .from("orders")
    .select("*, customers(name)", { count: "estimated" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("Error listing orders:", error);
    return { orders: [], total: 0, page, pageSize };
  }

  const mapped = (data || []).map((d: any) => ({
    id: d.id,
    org_id: d.org_id,
    order_number: d.order_number,
    customer_id: d.customer_id,
    status: d.status,
    created_at: d.created_at,
    requested_delivery_date: d.requested_delivery_date,
    subtotal_ex_vat: d.subtotal_ex_vat ?? null,
    vat_amount: d.vat_amount ?? null,
    total_inc_vat: d.total_inc_vat ?? null,
    customerName: d.customers?.name || "Unknown",
    customer: d.customers ? { name: d.customers.name } : null,
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
export async function getOrderById(orderId: string): Promise<Order & { lines: any[] } | null> {
  const supabase = await createClient();
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, customers(name)")
    .eq("id", orderId)
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


export async function getCustomers(): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
  return data as any[]; // Map to Supplier/Customer type if needed
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
  console.warn("get_product_availability RPC not available, using fallback");
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
    const batch: Batch = {
      id: b.id,
      orgId: "",
      batchNumber: b.batchNumber || "",
      plantVariety: b.plantVariety || "",
      size: b.size || "",
      category: b.category,
      quantity: b.quantity || 0,
      growerPhotoUrl: b.growerPhotoUrl,
      salesPhotoUrl: b.salesPhotoUrl,
      status: b.status as any,
      plantVarietyId: "",
      sizeId: "",
      locationId: "",
      phase: "finished",
    } as Batch;

    const productKey = `${batch.plantVariety}-${batch.size}`;

    if (productsMap.has(productKey)) {
      const existingProduct = productsMap.get(productKey)!;
      existingProduct.totalQuantity += batch.quantity!;
      existingProduct.availableBatches.push(batch);
    } else {
      productsMap.set(productKey, {
        id: productKey,
        plantVariety: batch.plantVariety!,
        size: batch.size!,
        category: batch.category,
        totalQuantity: batch.quantity!,
        barcode: `BARCODE-${batch.plantVariety?.replace(/\s+/g, "")}`,
        cost: 1.53,
        status: "Bud & flower",
        imageUrl:
          batch.growerPhotoUrl ||
          batch.salesPhotoUrl ||
          `https://placehold.co/100x100.png`,
        availableBatches: [batch],
      });
    }
  });

  return Array.from(productsMap.values());
}
