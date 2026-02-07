// src/server/sales/customers.server.ts
import "server-only";
import { z } from "zod";
import { logError } from "@/lib/log";

export const Customer = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  createdAt: z.string(), // ISO
});
export type Customer = z.infer<typeof Customer>;

import { createClient } from "@/lib/supabase/server";

export async function listCustomers(limit = 100): Promise<Customer[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map((d: any) => Customer.parse({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      createdAt: d.created_at,
    }));
  } catch (e: any) {
    logError("Error listing customers", { error: e?.message || String(e) });
    return [];
  }
}
