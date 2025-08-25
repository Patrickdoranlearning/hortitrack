
// src/server/sales/queries.server.ts
import "server-only";
import { adminDb } from "@/server/db/admin";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { z } from "zod";
import type { Supplier, Batch } from "@/lib/types";

export const OrderSchema = z.object({
  id: z.string(),
  customerName: z.string().min(1).default(""),
  customerId: z.string().optional(),
  status: z.enum(["draft", "open", "fulfilled", "cancelled", "confirmed", "picking", "ready", "dispatched", "delivered", "void"]),
  createdAt: z.any().transform(v => v?.toDate ? v.toDate().toISOString() : v), // Handle Timestamps
});
export type Order = z.infer<typeof OrderSchema>;

export const NewOrderSchema = z.object({
  customerName: z.string().min(1),
  total: z.number().nonnegative().default(0),
  status: z.enum(["draft", "open", "fulfilled", "cancelled"]).default("draft"),
});
export type NewOrder = z.infer<typeof NewOrderSchema>;

export async function listOrders(limit = 100, status?: string): Promise<Order[]> {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = adminDb
    .collection("sales_orders")
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (status) {
    query = query.where("status", "==", status);
  }

  const snap = await query.get();
  
  const customerIds = snap.docs
    .map(d => (d.data() as any).customerId)
    .filter((id): id is string => !!id && typeof id === 'string');

  let customers: Record<string, string> = {};
  if (customerIds.length > 0) {
    // Firestore 'in' query is limited to 30 items per query
    const chunks = [];
    for (let i = 0; i < customerIds.length; i += 30) {
      chunks.push(customerIds.slice(i, i + 30));
    }
    for (const chunk of chunks) {
      const customerSnap = await adminDb.collection("customers").where(adminDb.firestore.FieldPath.documentId(), 'in', chunk).get();
      customerSnap.docs.forEach(doc => {
          customers[doc.id] = (doc.data() as any).name || doc.id;
      });
    }
  }


  return snap.docs
    .map((d) => {
      const raw = { id: d.id, ...d.data() };
      const customerName = customers[raw.customerId] || raw.customerId || "Unknown";
      const parsed = OrderSchema.safeParse({ ...raw, customerName });
      if (!parsed.success) {
        console.warn("[sales:listOrders] invalid doc", d.id, parsed.error.flatten());
        return null;
      }
      return parsed.data;
    })
    .filter(Boolean) as Order[];
}

export async function createOrder(input: NewOrder): Promise<string> {
  const now = new Date().toISOString();
  const ref = await adminDb.collection("orders").add({
    customerName: input.customerName,
    total: input.total,
    status: input.status,
    createdAt: now,
  });
  return ref.id;
}


export async function getCustomers(): Promise<Supplier[]> {
    const snap = await adminDb.collection("suppliers").orderBy("name").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Supplier);
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

export async function getSaleableProducts(): Promise<SaleableProduct[]> {
    if (process.env.USE_SUPABASE_READS === "1") {
        const sb = getSupabaseForRequest();
        // Use v_sku_available + join lookup data we need for UI
        const { data, error } = await sb
        .from("v_sku_available")
        .select("sku_id, sku_code, description, default_vat_rate, available_qty");
        if (error) throw error;
        return (data ?? []).map(r => ({
            id: r.sku_code,
            plantVariety: r.description ?? r.sku_code,
            size: '',
            category: undefined,
            totalQuantity: Number(r.available_qty ?? 0),
            barcode: r.sku_code,
            cost: 0,
            status: "Available",
            imageUrl: undefined,
            availableBatches: [],
        }));
    }

    const saleableStatuses = ["Ready for Sale", "Looking Good"];
    const snapshot = await adminDb.collection('batches')
        .where('status', 'in', saleableStatuses)
        .where('quantity', '>', 0)
        .get();

    const productsMap = new Map<string, SaleableProduct>();

    snapshot.docs.forEach(doc => {
        const batch = { id: doc.id, ...doc.data() } as Batch;
        const productKey = `${batch.plantVariety}-${batch.size}`;

        if (productsMap.has(productKey)) {
            const existingProduct = productsMap.get(productKey)!;
            existingProduct.totalQuantity += batch.quantity;
            existingProduct.availableBatches.push(batch);
        } else {
            productsMap.set(productKey, {
                id: productKey,
                plantVariety: batch.plantVariety,
                size: batch.size,
                category: batch.category,
                totalQuantity: batch.quantity,
                barcode: `BARCODE-${batch.plantVariety.replace(/\s+/g, '')}`, // Example barcode
                cost: 1.53, // Example cost
                status: 'Bud & flower', // Example status
                imageUrl: batch.growerPhotoUrl || batch.salesPhotoUrl || `https://placehold.co/100x100.png`,
                availableBatches: [batch],
            });
        }
    });

    return Array.from(productsMap.values());
}
