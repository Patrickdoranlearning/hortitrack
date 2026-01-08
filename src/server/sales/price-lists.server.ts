// src/server/sales/price-lists.server.ts
import "server-only";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";

// =============================================================================
// TYPES
// =============================================================================

export const PriceListSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1),
  currency: z.string().length(3).default("EUR"),
  isDefault: z.boolean().default(false),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Computed fields
  customerCount: z.number().optional(),
  productCount: z.number().optional(),
});

export type PriceList = z.infer<typeof PriceListSchema>;

export const CreatePriceListInput = z.object({
  name: z.string().min(1, "Name is required"),
  currency: z.string().length(3).default("EUR"),
  isDefault: z.boolean().default(false),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export type CreatePriceListInput = z.infer<typeof CreatePriceListInput>;

export const UpdatePriceListInput = z.object({
  name: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
  isDefault: z.boolean().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export type UpdatePriceListInput = z.infer<typeof UpdatePriceListInput>;

// Price list customer assignment
export const PriceListCustomerSchema = z.object({
  id: z.string().uuid(),
  priceListId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().optional(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  createdAt: z.string(),
});

export type PriceListCustomer = z.infer<typeof PriceListCustomerSchema>;

// =============================================================================
// ROW MAPPING
// =============================================================================

type PriceListRow = {
  id: string;
  org_id: string;
  name: string;
  currency: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
};

function mapRowToPriceList(row: PriceListRow): PriceList {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    currency: row.currency,
    isDefault: row.is_default,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * List all price lists for the organization
 */
export async function listPriceLists(): Promise<PriceList[]> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("price_lists")
    .select("*")
    .eq("org_id", orgId)
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    console.error("[price-lists] Error listing:", error);
    throw new Error(error.message);
  }

  const priceLists = (data ?? []).map(mapRowToPriceList);

  // Get customer counts for each price list
  const { data: customerCounts } = await supabase
    .from("price_list_customers")
    .select("price_list_id")
    .eq("org_id", orgId);

  const countMap = new Map<string, number>();
  for (const row of customerCounts ?? []) {
    const current = countMap.get(row.price_list_id) ?? 0;
    countMap.set(row.price_list_id, current + 1);
  }

  // Get product price counts
  const { data: productCounts } = await supabase
    .from("product_prices")
    .select("price_list_id")
    .eq("org_id", orgId);

  const productCountMap = new Map<string, number>();
  for (const row of productCounts ?? []) {
    const current = productCountMap.get(row.price_list_id) ?? 0;
    productCountMap.set(row.price_list_id, current + 1);
  }

  return priceLists.map((pl) => ({
    ...pl,
    customerCount: countMap.get(pl.id) ?? 0,
    productCount: productCountMap.get(pl.id) ?? 0,
  }));
}

/**
 * Get a single price list by ID
 */
export async function getPriceListById(id: string): Promise<PriceList | null> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("price_lists")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[price-lists] Error fetching:", error);
    throw new Error(error.message);
  }

  return mapRowToPriceList(data);
}

/**
 * Create a new price list
 */
export async function createPriceList(input: CreatePriceListInput): Promise<PriceList> {
  const { supabase, orgId } = await getUserAndOrg();

  // If setting as default, unset other defaults first
  if (input.isDefault) {
    await supabase
      .from("price_lists")
      .update({ is_default: false })
      .eq("org_id", orgId)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("price_lists")
    .insert({
      org_id: orgId,
      name: input.name,
      currency: input.currency ?? "EUR",
      is_default: input.isDefault ?? false,
      valid_from: input.validFrom ?? null,
      valid_to: input.validTo ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[price-lists] Error creating:", error);
    throw new Error(error.message);
  }

  return mapRowToPriceList(data);
}

/**
 * Update an existing price list
 */
export async function updatePriceList(id: string, input: UpdatePriceListInput): Promise<PriceList> {
  const { supabase, orgId } = await getUserAndOrg();

  // If setting as default, unset other defaults first
  if (input.isDefault) {
    await supabase
      .from("price_lists")
      .update({ is_default: false })
      .eq("org_id", orgId)
      .eq("is_default", true)
      .neq("id", id);
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.isDefault !== undefined) updateData.is_default = input.isDefault;
  if (input.validFrom !== undefined) updateData.valid_from = input.validFrom;
  if (input.validTo !== undefined) updateData.valid_to = input.validTo;

  const { data, error } = await supabase
    .from("price_lists")
    .update(updateData)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[price-lists] Error updating:", error);
    throw new Error(error.message);
  }

  return mapRowToPriceList(data);
}

/**
 * Delete a price list
 */
export async function deletePriceList(id: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("price_lists")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("[price-lists] Error deleting:", error);
    throw new Error(error.message);
  }
}

// =============================================================================
// CUSTOMER ASSIGNMENT
// =============================================================================

/**
 * List customers assigned to a price list
 */
export async function listPriceListCustomers(priceListId: string): Promise<PriceListCustomer[]> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("price_list_customers")
    .select(`
      id,
      price_list_id,
      customer_id,
      valid_from,
      valid_to,
      created_at,
      customers!inner(name)
    `)
    .eq("org_id", orgId)
    .eq("price_list_id", priceListId);

  if (error) {
    console.error("[price-lists] Error listing customers:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    priceListId: row.price_list_id,
    customerId: row.customer_id,
    customerName: row.customers?.name,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
  }));
}

/**
 * Assign a customer to a price list
 */
export async function assignCustomerToPriceList(
  priceListId: string,
  customerId: string,
  validFrom?: string | null,
  validTo?: string | null
): Promise<PriceListCustomer> {
  const { supabase, orgId } = await getUserAndOrg();

  const { data, error } = await supabase
    .from("price_list_customers")
    .insert({
      org_id: orgId,
      price_list_id: priceListId,
      customer_id: customerId,
      valid_from: validFrom ?? null,
      valid_to: validTo ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[price-lists] Error assigning customer:", error);
    throw new Error(error.message);
  }

  return {
    id: data.id,
    priceListId: data.price_list_id,
    customerId: data.customer_id,
    validFrom: data.valid_from,
    validTo: data.valid_to,
    createdAt: data.created_at,
  };
}

/**
 * Remove a customer from a price list
 */
export async function removeCustomerFromPriceList(assignmentId: string): Promise<void> {
  const { supabase, orgId } = await getUserAndOrg();

  const { error } = await supabase
    .from("price_list_customers")
    .delete()
    .eq("id", assignmentId)
    .eq("org_id", orgId);

  if (error) {
    console.error("[price-lists] Error removing customer:", error);
    throw new Error(error.message);
  }
}

