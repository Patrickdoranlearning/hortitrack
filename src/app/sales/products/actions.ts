'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerClient } from '@/server/db/supabase';

const SALEABLE_BATCH_STATUSES = ['Ready for Sale', 'Looking Good'] as const;

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

const productAliasSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  aliasName: z.string().min(1, 'Alias name is required'),
  customerSkuCode: z.string().max(120).optional().nullable(),
  customerBarcode: z.string().max(255).optional().nullable(),
  unitPriceExVat: z.number().nonnegative().optional().nullable(),
  rrp: z.number().nonnegative().optional().nullable(),
  priceListId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
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

export async function autoLinkProductBatchesAction(productId: string) {
  if (!productId) {
    return { success: false, error: 'Product is required.' };
  }

  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select(
      `
      id,
      sku_id,
      skus (
        id,
        display_name,
        plant_variety_id,
        size_id
      )
    `
    )
    .eq('id', productId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (productError || !product) {
    console.error('[autoLinkProductBatchesAction] product lookup failed', productError);
    return { success: false, error: 'Unable to load product details.' };
  }

  const varietyId = product.skus?.plant_variety_id;
  const sizeId = product.skus?.size_id;
  if (!varietyId || !sizeId) {
    return {
      success: false,
      error: 'The product SKU is missing a variety or size, so matching batches cannot be found.',
    };
  }

  const { data: existingLinks, error: existingError } = await supabase
    .from('product_batches')
    .select('batch_id')
    .eq('product_id', productId);

  if (existingError) {
    console.error('[autoLinkProductBatchesAction] existing links lookup failed', existingError);
    return { success: false, error: 'Unable to inspect current batch links.' };
  }

  const existingIds = new Set(existingLinks?.map((entry) => entry.batch_id));

  const { data: candidates, error: candidateError } = await supabase
    .from('batches')
    .select('id')
    .eq('org_id', orgId)
    .eq('plant_variety_id', varietyId)
    .eq('size_id', sizeId)
    .in('status', SALEABLE_BATCH_STATUSES)
    .gt('quantity', 0);

  if (candidateError) {
    console.error('[autoLinkProductBatchesAction] batch lookup failed', candidateError);
    return { success: false, error: 'Unable to load matching batches.' };
  }

  const batchIdsToLink =
    candidates?.map((row) => row.id).filter((id) => id && !existingIds.has(id)) ?? [];

  if (batchIdsToLink.length === 0) {
    return {
      success: true,
      linked: 0,
      message: 'No additional batches matched this product.',
    };
  }

  const insertPayload = batchIdsToLink.map((batchId) => ({
    org_id: orgId,
    product_id: productId,
    batch_id: batchId,
  }));

  const { error: insertError } = await supabase.from('product_batches').insert(insertPayload);
  if (insertError) {
    console.error('[autoLinkProductBatchesAction] insert failed', insertError);
    return { success: false, error: insertError.message };
  }

  revalidatePath('/sales/products');
  return { success: true, linked: batchIdsToLink.length };
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

export async function upsertProductAliasAction(input: z.infer<typeof productAliasSchema>) {
  const parsed = productAliasSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  const payload = {
    org_id: orgId,
    product_id: parsed.productId,
    customer_id: parsed.customerId ?? null,
    alias_name: parsed.aliasName.trim(),
    customer_sku_code: cleanString(parsed.customerSkuCode),
    customer_barcode: cleanString(parsed.customerBarcode),
    unit_price_ex_vat: parsed.unitPriceExVat ?? null,
    rrp: parsed.rrp ?? null,
    price_list_id: parsed.priceListId ?? null,
    is_active: parsed.isActive ?? true,
    notes: cleanString(parsed.notes),
    updated_at: new Date().toISOString(),
  };

  let error;
  if (parsed.id) {
    ({ error } = await supabase.from('product_aliases').update(payload).eq('id', parsed.id));
  } else {
    ({ error } = await supabase.from('product_aliases').insert(payload));
  }

  if (error) {
    console.error('[upsertProductAliasAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function deleteProductAliasAction(aliasId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from('product_aliases').delete().eq('id', aliasId);
  if (error) {
    console.error('[deleteProductAliasAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

const createSkuSchema = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  displayName: z.string().trim().min(1, 'Display name is required'),
  description: z.string().trim().max(255).optional(),
  barcode: z.string().trim().min(1).max(255),
  vatRate: z.number().min(0).max(100).default(13.5),
});

export async function createSkuAction(input: z.infer<typeof createSkuSchema>) {
  const parsed = createSkuSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerClient();

  let skuCode = parsed.code?.trim() || '';
  if (!skuCode) {
    skuCode = await generateSkuCode(supabase);
  }
  if (parsed.code) {
    const { data: existing } = await supabase
      .from('skus')
      .select('id')
      .eq('org_id', orgId)
      .eq('code', skuCode)
      .maybeSingle();
    if (existing) {
      skuCode = `${skuCode}-${Date.now().toString(36).toUpperCase()}`;
    }
  }

  const { data, error } = await supabase
    .from('skus')
    .insert({
      org_id: orgId,
      code: skuCode,
      display_name: parsed.displayName,
      description: parsed.description ?? null,
      barcode: parsed.barcode,
      default_vat_rate: parsed.vatRate ?? 13.5,
      plant_variety_id: null,
      size_id: null,
    })
    .select()
    .single();

  if (error) {
    console.error('[createSkuAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true, data };
}

async function generateSkuCode(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  const { data, error } = await supabase.rpc('next_sku_code');
  console.log('[generateSkuCode] rpc result', { data, error, typeofData: typeof data });
  if (error) {
    console.error('[generateSkuCode] rpc error, fallback to timestamp', error);
    const fallback = Date.now().toString(36).toUpperCase();
    return `SKU-${fallback}`;
  }
  // data comes back as number or bigint from the sequence
  const seq = Number(data);
  if (Number.isNaN(seq)) {
    console.error('[generateSkuCode] invalid sequence value', data);
    const fallback = Date.now().toString(36).toUpperCase();
    return `SKU-${fallback}`;
  }
  const padded = String(seq).padStart(4, '0');
  return `SKU-${padded}`;
}

