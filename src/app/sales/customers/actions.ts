"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { customerFormSchema, customerAddressSchema, customerContactSchema, deliveryPreferencesSchema } from "./types";

function cleanString(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// =============================================================================
// CUSTOMER CRUD
// =============================================================================

export async function upsertCustomerAction(input: z.infer<typeof customerFormSchema>) {
  const parsed = customerFormSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const payload = {
    name: parsed.name.trim(),
    code: cleanString(parsed.code),
    email: cleanString(parsed.email),
    phone: cleanString(parsed.phone),
    vat_number: cleanString(parsed.vatNumber),
    notes: cleanString(parsed.notes),
    default_price_list_id: parsed.defaultPriceListId || null,
    store: cleanString(parsed.store),
    accounts_email: cleanString(parsed.accountsEmail),
    pricing_tier: cleanString(parsed.pricingTier),
    // New fields
    currency: parsed.currency ?? 'EUR',
    country_code: parsed.countryCode ?? 'IE',
    payment_terms_days: parsed.paymentTermsDays ?? 30,
    credit_limit: parsed.creditLimit ?? null,
    account_code: cleanString(parsed.accountCode),
  };

  let data;
  let error;

  if (parsed.id) {
    ({ data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", parsed.id)
      .select()
      .maybeSingle());
  } else {
    ({ data, error } = await supabase
      .from("customers")
      .insert({ ...payload, org_id: orgId })
      .select()
      .maybeSingle());
  }

  if (error) {
    console.error("[upsertCustomerAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  if (data?.id) {
    revalidatePath(`/sales/customers/${data.id}`);
  }
  return {
    success: true,
    data,
    _mutated: {
      resource: 'customers' as const,
      action: parsed.id ? 'update' as const : 'create' as const,
      id: data?.id,
    },
  };
}

export async function updateCustomerDefaultPriceListAction(customerId: string, priceListId: string | null) {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("customers")
    .update({ default_price_list_id: priceListId })
    .eq("id", customerId);

  if (error) {
    console.error("[updateCustomerDefaultPriceListAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${customerId}`);
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: customerId },
  };
}

export async function updateCustomerDeliveryPreferencesAction(input: z.infer<typeof deliveryPreferencesSchema>) {
  const parsed = deliveryPreferencesSchema.parse(input);
  const supabase = await getSupabaseServerApp();

  const prefs = {
    preferredTrolleyType: parsed.preferences.preferredTrolleyType ?? null,
    labelRequirements: parsed.preferences.labelRequirements ?? null,
    specialInstructions: parsed.preferences.specialInstructions ?? null,
  };

  const { error } = await supabase
    .from("customers")
    .update({ delivery_preferences: prefs })
    .eq("id", parsed.customerId);

  if (error) {
    console.error("[updateCustomerDeliveryPreferencesAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.customerId}`);
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function deleteCustomerAction(customerId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) {
    console.error("[deleteCustomerAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'delete' as const, id: customerId },
  };
}

// =============================================================================
// PRICE LIST ASSIGNMENTS
// =============================================================================

const priceListAssignmentSchema = z.object({
  customerId: z.string().uuid(),
  priceListId: z.string().uuid(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});

export async function assignPriceListToCustomerAction(input: z.infer<typeof priceListAssignmentSchema>) {
  const parsed = priceListAssignmentSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase.from("price_list_customers").insert({
    org_id: orgId,
    customer_id: parsed.customerId,
    price_list_id: parsed.priceListId,
    valid_from: parsed.validFrom || null,
    valid_to: parsed.validTo || null,
  });

  if (error) {
    console.error("[assignPriceListToCustomerAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function removePriceListAssignmentAction(assignmentId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("price_list_customers").delete().eq("id", assignmentId);
  if (error) {
    console.error("[removePriceListAssignmentAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// =============================================================================
// CUSTOMER ADDRESSES CRUD
// =============================================================================

export async function upsertCustomerAddressAction(input: z.infer<typeof customerAddressSchema>) {
  const parsed = customerAddressSchema.parse(input);
  const supabase = await getSupabaseServerApp();

  const payload = {
    customer_id: parsed.customerId,
    label: parsed.label.trim(),
    store_name: cleanString(parsed.storeName),
    line1: parsed.line1.trim(),
    line2: cleanString(parsed.line2),
    city: cleanString(parsed.city),
    county: cleanString(parsed.county),
    eircode: cleanString(parsed.eircode),
    country_code: parsed.countryCode || 'IE',
    is_default_shipping: parsed.isDefaultShipping ?? false,
    is_default_billing: parsed.isDefaultBilling ?? false,
    contact_name: cleanString(parsed.contactName),
    contact_email: cleanString(parsed.contactEmail),
    contact_phone: cleanString(parsed.contactPhone),
  };

  // If setting as default shipping, unset others first
  if (parsed.isDefaultShipping) {
    await supabase
      .from("customer_addresses")
      .update({ is_default_shipping: false })
      .eq("customer_id", parsed.customerId)
      .neq("id", parsed.id ?? "00000000-0000-0000-0000-000000000000");
  }

  // If setting as default billing, unset others first
  if (parsed.isDefaultBilling) {
    await supabase
      .from("customer_addresses")
      .update({ is_default_billing: false })
      .eq("customer_id", parsed.customerId)
      .neq("id", parsed.id ?? "00000000-0000-0000-0000-000000000000");
  }

  let data;
  let error;

  if (parsed.id) {
    ({ data, error } = await supabase
      .from("customer_addresses")
      .update(payload)
      .eq("id", parsed.id)
      .select()
      .maybeSingle());
  } else {
    ({ data, error } = await supabase
      .from("customer_addresses")
      .insert(payload)
      .select()
      .maybeSingle());
  }

  if (error) {
    console.error("[upsertCustomerAddressAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.customerId}`);
  return {
    success: true,
    data,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function deleteCustomerAddressAction(addressId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("customer_addresses").delete().eq("id", addressId);
  if (error) {
    console.error("[deleteCustomerAddressAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// =============================================================================
// CUSTOMER CONTACTS CRUD
// =============================================================================

export async function upsertCustomerContactAction(input: z.infer<typeof customerContactSchema>) {
  const parsed = customerContactSchema.parse(input);
  const supabase = await getSupabaseServerApp();

  const payload = {
    customer_id: parsed.customerId,
    name: parsed.name.trim(),
    email: cleanString(parsed.email),
    phone: cleanString(parsed.phone),
    mobile: cleanString(parsed.mobile),
    role: cleanString(parsed.role),
    is_primary: parsed.isPrimary ?? false,
  };

  // If setting as primary, unset others first
  if (parsed.isPrimary) {
    await supabase
      .from("customer_contacts")
      .update({ is_primary: false })
      .eq("customer_id", parsed.customerId)
      .neq("id", parsed.id ?? "00000000-0000-0000-0000-000000000000");
  }

  let data;
  let error;

  if (parsed.id) {
    ({ data, error } = await supabase
      .from("customer_contacts")
      .update(payload)
      .eq("id", parsed.id)
      .select()
      .maybeSingle());
  } else {
    ({ data, error } = await supabase
      .from("customer_contacts")
      .insert(payload)
      .select()
      .maybeSingle());
  }

  if (error) {
    console.error("[upsertCustomerContactAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.customerId}`);
  return {
    success: true,
    data,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function deleteCustomerContactAction(contactId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId);
  if (error) {
    console.error("[deleteCustomerContactAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// =============================================================================
// CUSTOMER PRODUCT PRICING (using product_aliases for RRP)
// =============================================================================

const customerProductPricingSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  aliasName: z.string().optional().nullable(),
  customerSkuCode: z.string().optional().nullable(),
  unitPriceExVat: z.number().nonnegative().optional().nullable(),
  rrp: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function upsertCustomerProductPricingAction(input: z.infer<typeof customerProductPricingSchema>) {
  const parsed = customerProductPricingSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Get product name for alias if not provided
  let aliasName = parsed.aliasName;
  if (!aliasName) {
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", parsed.productId)
      .single();
    aliasName = product?.name ?? "Product";
  }

  const payload = {
    org_id: orgId,
    product_id: parsed.productId,
    customer_id: parsed.customerId,
    alias_name: aliasName,
    customer_sku_code: cleanString(parsed.customerSkuCode),
    unit_price_ex_vat: parsed.unitPriceExVat ?? null,
    rrp: parsed.rrp ?? null,
    notes: cleanString(parsed.notes),
    is_active: true,
  };

  let data;
  let error;

  if (parsed.id) {
    ({ data, error } = await supabase
      .from("product_aliases")
      .update(payload)
      .eq("id", parsed.id)
      .select()
      .maybeSingle());
  } else {
    // Check if alias already exists for this customer/product combo
    const { data: existing } = await supabase
      .from("product_aliases")
      .select("id")
      .eq("product_id", parsed.productId)
      .eq("customer_id", parsed.customerId)
      .maybeSingle();

    if (existing) {
      ({ data, error } = await supabase
        .from("product_aliases")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .maybeSingle());
    } else {
      ({ data, error } = await supabase
        .from("product_aliases")
        .insert(payload)
        .select()
        .maybeSingle());
    }
  }

  if (error) {
    console.error("[upsertCustomerProductPricingAction]", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  return {
    success: true,
    data,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function deleteCustomerProductPricingAction(aliasId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("product_aliases").delete().eq("id", aliasId);
  if (error) {
    console.error("[deleteCustomerProductPricingAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// Fetch customer product pricing
export async function fetchCustomerProductPricingAction(customerId: string) {
  const supabase = await getSupabaseServerApp();
  
  const { data, error } = await supabase
    .from("product_aliases")
    .select(`
      id,
      product_id,
      alias_name,
      customer_sku_code,
      unit_price_ex_vat,
      rrp,
      notes,
      products (
        id,
        name,
        skus ( code )
      )
    `)
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("alias_name", { ascending: true });

  if (error) {
    console.error("[fetchCustomerProductPricingAction]", error);
    return { success: false, error: error.message, data: [] };
  }

  const pricing = data.map((row) => ({
    aliasId: row.id,
    productId: row.product_id,
    productName: (row.products as { name: string })?.name ?? "Unknown",
    skuCode: ((row.products as { skus: { code: string } | null })?.skus as { code: string } | null)?.code ?? null,
    aliasName: row.alias_name,
    customerSkuCode: row.customer_sku_code,
    unitPriceExVat: row.unit_price_ex_vat,
    rrp: row.rrp,
    notes: row.notes,
  }));

  return { success: true, data: pricing };
}

// =============================================================================
// B2B PORTAL ACCESS
// =============================================================================

const portalPasswordSchema = z.object({
  customerId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function setCustomerPortalPassword(input: z.infer<typeof portalPasswordSchema>) {
  const parsed = portalPasswordSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  try {
    // Create Supabase auth user with admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: {
        portal_role: 'customer',
        customer_id: parsed.customerId,
        org_id: orgId,
      },
    });

    if (authError) {
      console.error("[setCustomerPortalPassword] Auth error:", authError);
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: "Failed to create user" };
    }

    // Update profile to link to customer and set portal_role
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: authData.user.id,
        customer_id: parsed.customerId,
        portal_role: 'customer',
        org_id: orgId,
        full_name: parsed.email.split('@')[0], // Default name from email
      });

    if (profileError) {
      console.error("[setCustomerPortalPassword] Profile error:", profileError);
      // Try to delete the auth user if profile creation failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: profileError.message };
    }

    revalidatePath("/sales/customers");
    return {
      success: true,
      data: { userId: authData.user.id },
      _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
    };
  } catch (error) {
    console.error("[setCustomerPortalPassword] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
