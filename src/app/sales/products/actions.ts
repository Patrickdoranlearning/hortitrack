'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerClient } from '@/server/db/supabase';

const productDetailsSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  skuId: z.string().uuid({ message: 'SKU is required' }),
  description: z.string().max(2000).optional().nullable(),
  heroImageUrl: z.string().url().optional().or(z.literal('')).nullable(),
  defaultStatus: z.string().max(120).optional().nullable(),
  isActive: z.boolean().default(true),
});

const productBatchSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid(),
  availableQuantityOverride: z
    .union([z.number().int().nonnegative(), z.null()])
    .optional()
    .default(null),
});

const productPriceSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  priceListId: z.string().uuid(),
  unitPriceExVat: z.number().nonnegative(),
  currency: z.string().min(3).max(3).default('EUR'),
  minQty: z.number().int().positive().default(1),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});

const priceListCustomerSchema = z.object({
  id: z.string().uuid().optional(),
  priceListId: z.string().uuid(),
  customerId: z.string().uuid(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
});

function cleanString(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function upsertProductAction(input: z.infer<typeof productDetailsSchema>) {
  const parsed = productDetailsSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  const payload = {
    name: parsed.name,
    sku_id: parsed.skuId,
    description: cleanString(parsed.description),
    hero_image_url: cleanString(parsed.heroImageUrl),
    default_status: cleanString(parsed.defaultStatus),
    is_active: parsed.isActive ?? true,
  };

  let data;
  let error;
  if (parsed.id) {
    ({ data, error } = await supabase
      .from('products')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', parsed.id)
      .select()
      .maybeSingle());
  } else {
    ({ data, error } = await supabase
      .from('products')
      .insert({ ...payload, org_id: orgId })
      .select()
      .maybeSingle());
  }

  if (error) {
    console.error('[upsertProductAction] error', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true, data };
}

export async function deleteProductAction(productId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) {
    console.error('[deleteProductAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

export async function addProductBatchAction(input: z.infer<typeof productBatchSchema>) {
  const parsed = productBatchSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.from('product_batches').insert({
    org_id: orgId,
    product_id: parsed.productId,
    batch_id: parsed.batchId,
    available_quantity_override: parsed.availableQuantityOverride ?? null,
  });
  if (error) {
    console.error('[addProductBatchAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

export async function removeProductBatchAction(productBatchId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('product_batches').delete().eq('id', productBatchId);
  if (error) {
    console.error('[removeProductBatchAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

export async function upsertProductPriceAction(input: z.infer<typeof productPriceSchema>) {
  const parsed = productPriceSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  const payload = {
    product_id: parsed.productId,
    price_list_id: parsed.priceListId,
    unit_price_ex_vat: parsed.unitPriceExVat,
    currency: parsed.currency ?? 'EUR',
    min_qty: parsed.minQty ?? 1,
    valid_from: cleanString(parsed.validFrom),
    valid_to: cleanString(parsed.validTo),
    org_id: orgId,
  };

  let recordId = parsed.id ?? null;
  if (!recordId) {
    const { data: existing } = await supabase
      .from('product_prices')
      .select('id')
      .eq('product_id', parsed.productId)
      .eq('price_list_id', parsed.priceListId)
      .is('valid_from', payload.valid_from)
      .is('valid_to', payload.valid_to)
      .maybeSingle();
    if (existing) {
      recordId = existing.id;
    }
  }

  let error;
  if (recordId) {
    ({ error } = await supabase
      .from('product_prices')
      .update({
        unit_price_ex_vat: payload.unit_price_ex_vat,
        currency: payload.currency,
        min_qty: payload.min_qty,
        valid_from: payload.valid_from,
        valid_to: payload.valid_to,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId));
  } else {
    ({ error } = await supabase.from('product_prices').insert(payload));
  }

  if (error) {
    console.error('[upsertProductPriceAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function deleteProductPriceAction(priceId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('product_prices').delete().eq('id', priceId);
  if (error) {
    console.error('[deleteProductPriceAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

export async function upsertPriceListCustomerAction(input: z.infer<typeof priceListCustomerSchema>) {
  const parsed = priceListCustomerSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  const payload = {
    org_id: orgId,
    price_list_id: parsed.priceListId,
    customer_id: parsed.customerId,
    valid_from: cleanString(parsed.validFrom),
    valid_to: cleanString(parsed.validTo),
  };

  let recordId = parsed.id ?? null;
  if (!recordId) {
    const { data: existing } = await supabase
      .from('price_list_customers')
      .select('id')
      .eq('org_id', orgId)
      .eq('price_list_id', parsed.priceListId)
      .eq('customer_id', parsed.customerId)
      .is('valid_from', payload.valid_from)
      .is('valid_to', payload.valid_to)
      .maybeSingle();
    if (existing) {
      recordId = existing.id;
    }
  }

  let error;
  if (recordId) {
    ({ error } = await supabase
      .from('price_list_customers')
      .update({
        valid_from: payload.valid_from,
        valid_to: payload.valid_to,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId));
  } else {
    ({ error } = await supabase.from('price_list_customers').insert(payload));
  }

  if (error) {
    console.error('[upsertPriceListCustomerAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function deletePriceListCustomerAction(recordId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('price_list_customers').delete().eq('id', recordId);
  if (error) {
    console.error('[deletePriceListCustomerAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

export async function setCustomerDefaultPriceListAction(customerId: string, priceListId: string | null) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from('customers')
    .update({ default_price_list_id: priceListId })
    .eq('id', customerId);
  if (error) {
    console.error('[setCustomerDefaultPriceListAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

