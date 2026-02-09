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

export const CreateOrderLineSchema = z
  .object({
    productId: z.string().uuid().optional(),
    // Product group for generic/mix orders (e.g., "1L Heather Mix")
    productGroupId: z.string().uuid().optional(),
    // Product identity fallback (variety + size)
    plantVariety: z.string().optional(),
    size: z.string().optional(),
    description: z.string().optional(),
    qty: z.coerce.number().int().positive().default(1),
    allowSubstitute: z.boolean().optional().default(true),
    unitPrice: z.coerce.number().nonnegative().optional(), // optional override
    vatRate: z.coerce.number().min(0).max(100).optional(),
    // Pre-pricing (RRP printed on pots)
    rrp: z.coerce.number().nonnegative().optional(),
    // Multibuy pricing (e.g., "3 for €10")
    multibuyQty2: z.coerce.number().int().positive().optional(),
    multibuyPrice2: z.coerce.number().nonnegative().optional(),
    // Variety constraint (for variety-specific order lines)
    requiredVarietyId: z.string().uuid().optional(),
  })
  .refine(
    (val) => Boolean(val.productId) || Boolean(val.productGroupId) || (Boolean(val.plantVariety) && Boolean(val.size)),
    {
      message: "Select a product, product group, or provide both plant variety and size",
      path: ["productId"],
    }
  );

// Fee line for order creation (pre-pricing, delivery, etc.)
export const OrderFeeSchema = z.object({
  orgFeeId: z.string().uuid().optional(),
  feeType: z.string(),
  name: z.string(),
  quantity: z.number().int().nonnegative().default(1),
  unitAmount: z.number().nonnegative(),
  unit: z.string().default('flat'),
  vatRate: z.number().min(0).max(100).default(0),
  isFoc: z.boolean().optional().default(false),
});
export type OrderFeeInput = z.infer<typeof OrderFeeSchema>;

export const CreateOrderSchema = z.object({
  customerId: z.string().min(1),
  storeId: z.string().min(1).optional(),
  shipToAddressId: z.string().uuid().optional(), // The customer_addresses.id for shipping
  deliveryAddress: z.string().optional(),
  orderReference: z.string().optional(),
  currency: z.enum(['EUR', 'GBP']).default('EUR'),
  deliveryDate: z.string().optional(), // ISO
  shipMethod: z.enum(["van", "haulier", "collection"]).optional().or(z.literal('')),
  notesCustomer: z.string().optional(),
  notesInternal: z.string().optional(),
  autoPrint: z.boolean().optional().default(true),
  lines: z.array(CreateOrderLineSchema).min(1),
  fees: z.array(OrderFeeSchema).optional().default([]),
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

// Variety breakdown for product group orders AND regular product variety selection
// Allows specifying per-variety quantities within a product group or product
export type VarietyBreakdown = {
  productId: string;       // child product ID (groups) or parent product ID (regular products)
  varietyId?: string;      // plant_variety UUID (for regular products only)
  productName: string;     // display name (e.g., "Eline")
  qty: number;             // specified quantity (0 = not specified)
  availableStock: number;  // for display/validation
};

// Keyed by react-hook-form field.id for stable indexing
export type VarietyBreakdownMap = Record<string, VarietyBreakdown[]>;

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

// Customer address type for sales order wizard
export type CustomerAddress = {
  id: string;
  label: string;
  storeName: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  county: string | null;
  eircode: string | null;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};
