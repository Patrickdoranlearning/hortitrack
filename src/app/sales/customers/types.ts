import { z } from "zod";

// Country codes for VAT treatment
export const COUNTRY_OPTIONS = [
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'XI', name: 'Northern Ireland', currency: 'GBP' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
] as const;

export const CURRENCY_OPTIONS = ['EUR', 'GBP'] as const;

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
  // New fields
  currency: string;
  countryCode: string;
  paymentTermsDays: number;
  creditLimit: number | null;
  accountCode: string | null;
  deliveryPreferences: DeliveryPreferences | null;
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
  // Related data
  addresses: CustomerAddressSummary[];
  contacts: CustomerContactSummary[];
};

export type CustomerAddressSummary = {
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
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export type CustomerContactSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  role: string | null;
  isPrimary: boolean;
};

export type DeliveryPreferences = {
  preferredTrolleyType?: 'tag6' | 'dc' | 'danish' | 'dutch';
  labelRequirements?: 'yellow_tag' | 'no_tag' | 'any';
  specialInstructions?: string | null;
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
  // New fields
  currency?: string;
  countryCode?: string;
  paymentTermsDays?: number;
  creditLimit?: number | null;
  accountCode?: string | null;
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
  // New fields
  currency: z.enum(['EUR', 'GBP']).default('EUR'),
  countryCode: z.enum(['IE', 'GB', 'XI', 'NL']).default('IE'),
  paymentTermsDays: z.number().int().min(0).default(30),
  creditLimit: z.number().nonnegative().optional().nullable(),
  accountCode: z.string().max(50).optional().nullable(),
});

export const customerAddressSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  label: z.string().min(1, "Address label is required"),
  storeName: z.string().max(100).optional().nullable(),
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  county: z.string().max(100).optional().nullable(),
  eircode: z.string().max(20).optional().nullable(),
  countryCode: z.string().length(2).default('IE'),
  isDefaultShipping: z.boolean().default(false),
  isDefaultBilling: z.boolean().default(false),
  contactName: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(30).optional().nullable(),
});

export const customerContactSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  mobile: z.string().max(30).optional().nullable(),
  role: z.string().max(50).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const deliveryPreferencesSchema = z.object({
  customerId: z.string().uuid(),
  preferences: z.object({
    preferredTrolleyType: z.enum(['tag6', 'dc', 'danish', 'dutch']).optional().nullable(),
    labelRequirements: z.enum(['yellow_tag', 'no_tag', 'any']).optional().nullable(),
    specialInstructions: z.string().max(500).optional().nullable(),
  }),
});

export type CustomerManagementPayload = {
  customers: CustomerSummary[];
  priceLists: Array<{ id: string; name: string; currency: string; isDefault: boolean }>;
  products: Array<{ id: string; name: string; skuCode: string | null }>;
};

// Customer product pricing (for the pricing tab)
export type CustomerProductPricing = {
  aliasId: string;
  productId: string;
  productName: string;
  skuCode: string | null;
  aliasName: string | null;
  customerSkuCode: string | null;
  unitPriceExVat: number | null;
  rrp: number | null;
  notes: string | null;
};

