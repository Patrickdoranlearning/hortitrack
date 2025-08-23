
import "server-only";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";
import type { Supplier } from "@/lib/types";

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
