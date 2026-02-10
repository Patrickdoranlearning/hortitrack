"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { customerFormSchema, customerAddressSchema, customerContactSchema, deliveryPreferencesSchema } from "./types";
import type { CustomerFollowUp, CustomerMilestone, MilestoneType } from "./[customerId]/types";
import type { ActionResult } from "@/lib/errors";
import { logError } from "@/lib/log";

// Mutation metadata for SWR cache invalidation (via useMutation hook)
type MutatedMeta = {
  _mutated: {
    resource: 'customers' | 'follow_ups' | 'milestones';
    action: 'create' | 'update' | 'delete';
    id?: string;
  };
};

function cleanString(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// =============================================================================
// CUSTOMER CRUD
// =============================================================================

export async function upsertCustomerAction(
  input: z.infer<typeof customerFormSchema>
): Promise<(ActionResult<Record<string, unknown> | null> & MutatedMeta) | ActionResult<never>> {
  const validation = customerFormSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
    requires_pre_pricing: parsed.requiresPrePricing ?? false,
    pre_pricing_foc: parsed.prePricingFoc ?? false,
    pre_pricing_cost_per_label: parsed.prePricingCostPerLabel ?? null,
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
    logError("[upsertCustomerAction]", { error: error.message });
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

export async function updateCustomerDefaultPriceListAction(
  customerId: string,
  priceListId: string | null
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from("customers")
    .update({ default_price_list_id: priceListId })
    .eq("id", customerId);

  if (error) {
    logError("[updateCustomerDefaultPriceListAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${customerId}`);
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: customerId },
  };
}

export async function updateCustomerDeliveryPreferencesAction(
  input: z.infer<typeof deliveryPreferencesSchema>
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const validation = deliveryPreferencesSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
    logError("[updateCustomerDeliveryPreferencesAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.customerId}`);
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function deleteCustomerAction(
  customerId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) {
    logError("[deleteCustomerAction]", { error: error.message });
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true as const,
    data: null,
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

export async function assignPriceListToCustomerAction(
  input: z.infer<typeof priceListAssignmentSchema>
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const validation = priceListAssignmentSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
    logError("[assignPriceListToCustomerAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function removePriceListAssignmentAction(
  assignmentId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("price_list_customers").delete().eq("id", assignmentId);
  if (error) {
    logError("[removePriceListAssignmentAction]", { error: error.message });
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// =============================================================================
// CUSTOMER ADDRESSES CRUD
// =============================================================================

export async function upsertCustomerAddressAction(
  input: z.infer<typeof customerAddressSchema>
): Promise<(ActionResult<Record<string, unknown> | null> & MutatedMeta) | ActionResult<never>> {
  const validation = customerAddressSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
    logError("[upsertCustomerAddressAction]", { error: error.message });
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

export async function deleteCustomerAddressAction(
  addressId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("customer_addresses").delete().eq("id", addressId);
  if (error) {
    logError("[deleteCustomerAddressAction]", { error: error.message });
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// =============================================================================
// CUSTOMER CONTACTS CRUD
// =============================================================================

export async function upsertCustomerContactAction(
  input: z.infer<typeof customerContactSchema>
): Promise<(ActionResult<Record<string, unknown> | null> & MutatedMeta) | ActionResult<never>> {
  const validation = customerContactSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
    logError("[upsertCustomerContactAction]", { error: error.message });
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

export async function deleteCustomerContactAction(
  contactId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId);
  if (error) {
    logError("[deleteCustomerContactAction]", { error: error.message });
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true as const,
    data: null,
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

export async function upsertCustomerProductPricingAction(
  input: z.infer<typeof customerProductPricingSchema>
): Promise<(ActionResult<Record<string, unknown> | null> & MutatedMeta) | ActionResult<never>> {
  const validation = customerProductPricingSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
    logError("[upsertCustomerProductPricingAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  return {
    success: true,
    data,
    _mutated: { resource: 'customers' as const, action: 'update' as const, id: parsed.customerId },
  };
}

export async function deleteCustomerProductPricingAction(
  aliasId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from("product_aliases").delete().eq("id", aliasId);
  if (error) {
    logError("[deleteCustomerProductPricingAction]", { error: error.message });
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'customers' as const, action: 'update' as const },
  };
}

// Fetch customer product pricing
type CustomerProductPricing = {
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

export async function fetchCustomerProductPricingAction(
  customerId: string
): Promise<ActionResult<CustomerProductPricing[]>> {
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
    logError("[fetchCustomerProductPricingAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  const pricing: CustomerProductPricing[] = data.map((row) => ({
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

export async function setCustomerPortalPassword(
  input: z.infer<typeof portalPasswordSchema>
): Promise<(ActionResult<{ userId: string }> & MutatedMeta) | ActionResult<never>> {
  const validation = portalPasswordSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
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
      logError("[setCustomerPortalPassword] Auth error", { error: authError.message });
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
      logError("[setCustomerPortalPassword] Profile error", { error: profileError.message });
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
    logError("[setCustomerPortalPassword] Unexpected error", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}

// =============================================================================
// CUSTOMER FOLLOW-UPS
// =============================================================================

const createFollowUpSchema = z.object({
  customerId: z.string().uuid(),
  dueDate: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  sourceInteractionId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
});

export async function createFollowUpAction(
  input: z.infer<typeof createFollowUpSchema>
): Promise<(ActionResult<Record<string, unknown>> & MutatedMeta) | ActionResult<never>> {
  const validation = createFollowUpSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
  const { orgId, userId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_follow_ups")
    .insert({
      org_id: orgId,
      customer_id: parsed.customerId,
      due_date: parsed.dueDate,
      title: parsed.title.trim(),
      description: parsed.description?.trim() || null,
      source_interaction_id: parsed.sourceInteractionId || null,
      assigned_to: parsed.assignedTo || userId,
      status: 'pending',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    logError("[createFollowUpAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.customerId}`);
  return {
    success: true,
    data,
    _mutated: { resource: 'follow_ups' as const, action: 'create' as const, id: data?.id },
  };
}

export async function completeFollowUpAction(
  followUpId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const { userId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_follow_ups")
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq("id", followUpId)
    .select("customer_id")
    .single();

  if (error) {
    logError("[completeFollowUpAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  if (data?.customer_id) {
    revalidatePath(`/sales/customers/${data.customer_id}`);
  }
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'follow_ups' as const, action: 'update' as const, id: followUpId },
  };
}

export async function cancelFollowUpAction(
  followUpId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_follow_ups")
    .update({ status: 'cancelled' })
    .eq("id", followUpId)
    .select("customer_id")
    .single();

  if (error) {
    logError("[cancelFollowUpAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  if (data?.customer_id) {
    revalidatePath(`/sales/customers/${data.customer_id}`);
  }
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'follow_ups' as const, action: 'update' as const, id: followUpId },
  };
}

export async function getCustomerFollowUpsAction(
  customerId: string,
  includeCompleted = false
): Promise<ActionResult<CustomerFollowUp[]>> {
  const supabase = await getSupabaseServerApp();

  let query = supabase
    .from("customer_follow_ups")
    .select(`
      id,
      customer_id,
      source_interaction_id,
      assigned_to,
      due_date,
      title,
      description,
      status,
      completed_at,
      completed_by,
      created_at,
      assigned_user:profiles!customer_follow_ups_assigned_to_fkey(display_name),
      completed_user:profiles!customer_follow_ups_completed_by_fkey(display_name)
    `)
    .eq("customer_id", customerId)
    .order("due_date", { ascending: true });

  if (!includeCompleted) {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query;

  if (error) {
    logError("[getCustomerFollowUpsAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  const followUps: CustomerFollowUp[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    customerId: row.customer_id as string,
    sourceInteractionId: row.source_interaction_id as string | null,
    assignedToId: row.assigned_to as string | null,
    assignedToName: (row.assigned_user as { display_name?: string } | null)?.display_name ?? null,
    dueDate: row.due_date as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as 'pending' | 'completed' | 'cancelled',
    completedAt: row.completed_at as string | null,
    completedByName: (row.completed_user as { display_name?: string } | null)?.display_name ?? null,
    createdAt: row.created_at as string,
  }));

  return { success: true, data: followUps };
}

export async function getMyFollowUpsAction(): Promise<ActionResult<(CustomerFollowUp & { customerName: string })[]>> {
  const { userId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_follow_ups")
    .select(`
      id,
      customer_id,
      source_interaction_id,
      assigned_to,
      due_date,
      title,
      description,
      status,
      completed_at,
      created_at,
      customers(name)
    `)
    .eq("assigned_to", userId)
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  if (error) {
    logError("[getMyFollowUpsAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  const followUps = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    customerId: row.customer_id as string,
    sourceInteractionId: row.source_interaction_id as string | null,
    assignedToId: row.assigned_to as string | null,
    assignedToName: null as string | null,
    dueDate: row.due_date as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as 'pending' | 'completed' | 'cancelled',
    completedAt: row.completed_at as string | null,
    completedByName: null as string | null,
    createdAt: row.created_at as string,
    customerName: (row.customers as { name?: string } | null)?.name ?? 'Unknown Customer',
  }));

  return { success: true, data: followUps };
}

// =============================================================================
// CUSTOMER MILESTONES
// =============================================================================

const createMilestoneSchema = z.object({
  customerId: z.string().uuid(),
  milestoneType: z.enum(['anniversary', 'first_order', 'contract_renewal', 'seasonal_peak', 'custom']),
  title: z.string().min(1, "Title is required"),
  eventDate: z.string(),
  description: z.string().optional().nullable(),
  recurring: z.boolean().optional().default(false),
});

export async function createMilestoneAction(
  input: z.infer<typeof createMilestoneSchema>
): Promise<(ActionResult<Record<string, unknown>> & MutatedMeta) | ActionResult<never>> {
  const validation = createMilestoneSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }
  const parsed = validation.data;
  const { orgId, userId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_milestones")
    .insert({
      org_id: orgId,
      customer_id: parsed.customerId,
      milestone_type: parsed.milestoneType,
      title: parsed.title.trim(),
      description: parsed.description?.trim() || null,
      event_date: parsed.eventDate,
      recurring: parsed.recurring ?? false,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    logError("[createMilestoneAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  revalidatePath(`/sales/customers/${parsed.customerId}`);
  return {
    success: true,
    data,
    _mutated: { resource: 'milestones' as const, action: 'create' as const, id: data?.id },
  };
}

export async function deleteMilestoneAction(
  milestoneId: string
): Promise<(ActionResult<null> & MutatedMeta) | ActionResult<never>> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_milestones")
    .delete()
    .eq("id", milestoneId)
    .select("customer_id")
    .single();

  if (error) {
    logError("[deleteMilestoneAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  revalidatePath("/sales/customers");
  if (data?.customer_id) {
    revalidatePath(`/sales/customers/${data.customer_id}`);
  }
  return {
    success: true as const,
    data: null,
    _mutated: { resource: 'milestones' as const, action: 'delete' as const, id: milestoneId },
  };
}

export async function getCustomerMilestonesAction(
  customerId: string
): Promise<ActionResult<CustomerMilestone[]>> {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from("customer_milestones")
    .select(`
      id,
      customer_id,
      milestone_type,
      title,
      description,
      event_date,
      recurring,
      created_at
    `)
    .eq("customer_id", customerId)
    .order("event_date", { ascending: true });

  if (error) {
    logError("[getCustomerMilestonesAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  const milestones: CustomerMilestone[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    customerId: row.customer_id as string,
    milestoneType: row.milestone_type as MilestoneType,
    title: row.title as string,
    description: row.description as string | null,
    eventDate: row.event_date as string,
    recurring: row.recurring as boolean,
    createdAt: row.created_at as string,
  }));

  return { success: true, data: milestones };
}

export async function getUpcomingMilestonesAction(
  customerId: string,
  days = 90
): Promise<ActionResult<CustomerMilestone[]>> {
  const supabase = await getSupabaseServerApp();

  // Get all milestones for this customer
  const { data, error } = await supabase
    .from("customer_milestones")
    .select(`
      id,
      customer_id,
      milestone_type,
      title,
      description,
      event_date,
      recurring,
      created_at
    `)
    .eq("customer_id", customerId);

  if (error) {
    logError("[getUpcomingMilestonesAction]", { error: error.message });
    return { success: false, error: error.message };
  }

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);

  // Filter to upcoming milestones (including recurring ones)
  const upcoming: CustomerMilestone[] = [];

  for (const row of data ?? []) {
    const milestone: CustomerMilestone = {
      id: row.id,
      customerId: row.customer_id,
      milestoneType: row.milestone_type as MilestoneType,
      title: row.title,
      description: row.description,
      eventDate: row.event_date,
      recurring: row.recurring,
      createdAt: row.created_at,
    };

    const eventDate = new Date(row.event_date);

    if (row.recurring) {
      // For recurring milestones, calculate the next occurrence this year or next
      const thisYear = today.getFullYear();
      const nextOccurrence = new Date(thisYear, eventDate.getMonth(), eventDate.getDate());

      // If this year's occurrence has passed, use next year's
      if (nextOccurrence < today) {
        nextOccurrence.setFullYear(thisYear + 1);
      }

      // Check if within range
      if (nextOccurrence <= futureDate) {
        // Update event_date to show the upcoming occurrence
        upcoming.push({
          ...milestone,
          eventDate: nextOccurrence.toISOString().split('T')[0],
        });
      }
    } else {
      // Non-recurring: check if event is in the future and within range
      if (eventDate >= today && eventDate <= futureDate) {
        upcoming.push(milestone);
      }
    }
  }

  // Sort by upcoming date
  upcoming.sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  return { success: true, data: upcoming };
}
