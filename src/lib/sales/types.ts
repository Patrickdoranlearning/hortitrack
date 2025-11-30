// src/lib/sales/types.ts
import { z } from "zod";

export const SalesOrderStatus = z.enum([
  "draft",
  "confirmed",
  "picking",
  "ready",
  "dispatched",
  "delivered",
  "void",
]);
export type SalesOrderStatus = z.infer<typeof SalesOrderStatus>;

export const CreateOrderLineSchema = z.object({
  // Product identity (MVP: variety + size == product)
  plantVariety: z.string().min(1),
  size: z.string().min(1),
  qty: z.number().int().positive(),
  allowSubstitute: z.boolean().optional().default(false),
  unitPrice: z.number().nonnegative().optional(), // optional override
});

export const CreateOrderSchema = z.object({
  customerId: z.string().min(1),
  storeId: z.string().min(1),
  deliveryDate: z.string().optional(), // ISO
  shipMethod: z.enum(["van", "haulier"]).optional(),
  notesCustomer: z.string().optional(),
  notesInternal: z.string().optional(),
  autoPrint: z.boolean().optional().default(true),
  lines: z.array(CreateOrderLineSchema).min(1),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export type Allocation = {
  batchId: string;
  batchNumber?: string;
  qty: number;
  grade?: string;
  location?: string;
};

export type AllocatedLine = {
  plantVariety: string;
  size: string;
  qty: number; // requested
  unitPrice?: number;
  allocations: Allocation[]; // actual split across batches
};

export const SalesOrderDocSchema = z.object({
  id: z.string().optional(),
  customerId: z.string(),
  storeId: z.string(),
  status: SalesOrderStatus,
  currency: z.string().default("EUR"),
  deliveryDate: z.string().nullable().optional(),
  shipMethod: z.string().nullable().optional(),
  notesCustomer: z.string().nullable().optional(),
  notesInternal: z.string().nullable().optional(),
  totalsExVat: z.number().default(0),
  vat: z.number().default(0),
  totalsIncVat: z.number().default(0),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});
export type SalesOrderDoc = z.infer<typeof SalesOrderDocSchema>;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  availableStock: number;
}

export interface OrderItem {
  productId: string;
  productName: string; // Optional: for easier display
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; // Example statuses
}

import { Database } from '@/types/supabase';

export type SalesOrder = Database['public']['Tables']['orders']['Row'];
export type SalesOrderItem = Database['public']['Tables']['order_items']['Row'];
export type PickOrder = Database['public']['Tables']['pick_orders']['Row'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type CreditNote = Database['public']['Tables']['credit_notes']['Row'];
