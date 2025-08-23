
import "server-only";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import type { Supplier } from "@/lib/types";
import type { Batch } from "@/lib/types";

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().default(""),
  status: z.string().default("draft"),
  createdAt: z.any().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export async function listOrders(limit = 50): Promise<Order[]> {
  const snap = await adminDb.collection("sales_orders")
    .orderBy("createdAt", "desc").limit(limit).get();

  const customerIds = snap.docs
      .map(d => (d.data() as any).customerId)
      .filter((id): id is string => !!id);
  
  let customers: Record<string, string> = {};
  if (customerIds.length > 0) {
    const customerSnap = await adminDb.collection("customers").where(adminDb.firestore.FieldPath.documentId(), 'in', customerIds).get();
    customerSnap.docs.forEach(doc => {
        customers[doc.id] = (doc.data() as any).name || doc.id;
    });
  }

  return snap.docs.map(d => {
    const data = d.data() as any;
    return OrderSchema.parse({ 
      id: d.id, 
      ...data,
      customerName: customers[data.customerId] || data.customerId
    });
  });
}

export async function getOrderById(orderId: string): Promise<Order & { lines: any[] } | null> {
  const doc = await adminDb.collection("sales_orders").doc(orderId).get();
  if (!doc.exists) return null;

  const orderData = doc.data() as any;
  let customerName = orderData.customerId;
  if (orderData.customerId) {
      const customerDoc = await adminDb.collection("customers").doc(orderData.customerId).get();
      if (customerDoc.exists) {
          customerName = (customerDoc.data() as any).name || orderData.customerId;
      }
  }

  const linesSnap = await doc.ref.collection("lines").get();
  const lines = linesSnap.docs.map(lineDoc => ({ id: lineDoc.id, ...lineDoc.data() }));
  
  return { 
    ...OrderSchema.parse({ id: doc.id, ...orderData, customerName }),
    lines
  };
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
