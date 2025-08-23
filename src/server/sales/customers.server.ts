// src/server/sales/customers.server.ts
import "server-only";
import { adminDb } from "@/server/db/admin";
import { z } from "zod";
import { mapFirebaseAdminError } from "@/server/errors";

export const Customer = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  createdAt: z.string(), // ISO
});
export type Customer = z.infer<typeof Customer>;

export async function listCustomers(limit = 100): Promise<Customer[]> {
  try {
    const snap = await adminDb
      .collection("customers")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((raw) => Customer.parse(raw));
  } catch (e) {
    throw mapFirebaseAdminError(e);
  }
}
