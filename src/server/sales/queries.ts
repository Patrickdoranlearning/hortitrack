import "server-only";
import { z } from "zod";
import { adminDb } from "@/server/db/admin";

export const OrderSchema = z.object({
  id: z.string(),
  customerName: z.string().default(""),
  status: z.string().default("draft"),
  createdAt: z.any().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export async function listOrders(limit = 50): Promise<Order[]> {
  const snap = await adminDb.collection("orders")
    .orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map(d => OrderSchema.parse({ id: d.id, ...d.data() }));
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const doc = await adminDb.collection("orders").doc(orderId).get();
  if (!doc.exists) return null;
  return OrderSchema.parse({ id: doc.id, ...doc.data() });
}