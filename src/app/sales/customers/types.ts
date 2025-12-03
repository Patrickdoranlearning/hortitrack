import { z } from "zod";

export type CustomerSummary = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  notes: string | null;
  defaultPriceListId: string | null;
  defaultPriceListName: string | null;
  store: string | null;
  accountsEmail: string | null;
  pricingTier: string | null;
  createdAt: string | null;
  // Aggregated data
  orderCount: number;
  aliasCount: number;
  priceListAssignments: Array<{
    id: string;
    priceListId: string;
    priceListName: string;
    validFrom: string | null;
    validTo: string | null;
  }>;
};

export type CustomerFormData = {
  id?: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  notes?: string | null;
  defaultPriceListId?: string | null;
  store?: string | null;
  accountsEmail?: string | null;
  pricingTier?: string | null;
};

export const customerFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Customer name is required"),
  code: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  vatNumber: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  defaultPriceListId: z.string().uuid().optional().nullable(),
  store: z.string().max(100).optional().nullable(),
  accountsEmail: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  pricingTier: z.string().max(50).optional().nullable(),
});

export type CustomerManagementPayload = {
  customers: CustomerSummary[];
  priceLists: Array<{ id: string; name: string; currency: string; isDefault: boolean }>;
};

