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

export async function listOrders(limit = 100, status?: string): Promise<Order[]> {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, customers(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error listing orders:", error);
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    customerName: d.customers?.name || "Unknown",
    customerId: d.customer_id,
    status: d.status,
    createdAt: d.created_at,
  }));
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

export async function getSaleableProducts(): Promise<SaleableProduct[]> {
  // Fetch available batches from shared service
  const batches = await getSaleableBatches();

  const productsMap = new Map<string, SaleableProduct>();

  batches.forEach((b) => {
    // Map InventoryBatch to Batch type if needed
    const batch: Batch = {
      id: b.id,
      orgId: "", // Not needed for display here
      batchNumber: b.batchNumber || "",
      plantVariety: b.plantVariety || "",
      size: b.size || "",
      category: b.category,
      quantity: b.quantity || 0,
      growerPhotoUrl: b.growerPhotoUrl,
      salesPhotoUrl: b.salesPhotoUrl,
      status: b.status as any,
      plantVarietyId: "", // Missing from InventoryBatch, maybe add?
      sizeId: "",
      locationId: "",
      phase: "finished", // Default
      // ... map other fields
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
        barcode: `BARCODE-${batch.plantVariety?.replace(/\s+/g, '')}`,
        cost: 1.53,
        status: 'Bud & flower',
        imageUrl: batch.growerPhotoUrl || batch.salesPhotoUrl || `https://placehold.co/100x100.png`,
        availableBatches: [batch],
      });
    }
  });

  return Array.from(productsMap.values());
}
