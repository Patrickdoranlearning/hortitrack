"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerClient } from "@/server/db/supabase";
import { customerFormSchema } from "./types";

function cleanString(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function upsertCustomerAction(input: z.infer<typeof customerFormSchema>) {
  const parsed = customerFormSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

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
  return { success: true, data };
}

export async function deleteCustomerAction(customerId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) {
    console.error("[deleteCustomerAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return { success: true };
}

const priceListAssignmentSchema = z.object({
  customerId: z.string().uuid(),
  priceListId: z.string().uuid(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});

export async function assignPriceListToCustomerAction(input: z.infer<typeof priceListAssignmentSchema>) {
  const parsed = priceListAssignmentSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

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
  return { success: true };
}

export async function removePriceListAssignmentAction(assignmentId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("price_list_customers").delete().eq("id", assignmentId);
  if (error) {
    console.error("[removePriceListAssignmentAction]", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/sales/customers");
  return { success: true };
}

