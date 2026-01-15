'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerApp, supabaseAdmin } from '@/server/db/supabase';

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
  const supabase = await getSupabaseServerApp();

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
    // Check for duplicate SKU constraint violation
    if (error.code === '23505' && error.message.includes('products_sku_id_key')) {
      return {
        success: false,
        error: 'This SKU is already linked to another product. Please select a different SKU or create a new one.'
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true, data };
}

export async function deleteProductAction(productId: string) {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('org_id', orgId);
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
  const supabase = await getSupabaseServerApp();

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
  const supabase = await getSupabaseServerApp();
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
  const supabase = await getSupabaseServerApp();

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

  // Get ALL batches with stock (link at inception, not just saleable)
  const { data: candidates, error: candidateError } = await supabase
    .from('batches')
    .select('id')
    .eq('org_id', orgId)
    .eq('plant_variety_id', varietyId)
    .eq('size_id', sizeId)
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
  const supabase = await getSupabaseServerApp();

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
  const supabase = await getSupabaseServerApp();
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
  const supabase = await getSupabaseServerApp();

  // Check if assignment already exists for this customer
  const { data: existing } = await supabase
    .from('price_list_customers')
    .select('id')
    .eq('org_id', orgId)
    .eq('customer_id', parsed.customerId)
    .maybeSingle();

  let error;
  if (existing) {
    // Update existing assignment to new price list
    ({ error } = await supabase
      .from('price_list_customers')
      .update({
        price_list_id: parsed.priceListId,
        valid_from: null,
        valid_to: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id));
  } else {
    // Create new assignment (no date restrictions)
    ({ error } = await supabase.from('price_list_customers').insert({
      org_id: orgId,
      price_list_id: parsed.priceListId,
      customer_id: parsed.customerId,
      valid_from: null,
      valid_to: null,
    }));
  }

  if (error) {
    console.error('[upsertPriceListCustomerAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function deletePriceListCustomerAction(recordId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from('price_list_customers').delete().eq('id', recordId);
  if (error) {
    console.error('[deletePriceListCustomerAction]', error);
    return { success: false, error: error.message };
  }
  revalidatePath('/sales/products');
  return { success: true };
}

export async function setCustomerDefaultPriceListAction(customerId: string, priceListId: string | null) {
  const supabase = await getSupabaseServerApp();
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
  const supabase = await getSupabaseServerApp();

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
  const supabase = await getSupabaseServerApp();
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

const updateSkuConfigSchema = z.object({
  skuId: z.string().uuid(),
  plantVarietyId: z.string().uuid().nullable(),
  sizeId: z.string().uuid().nullable(),
});

export async function createSkuAction(input: z.infer<typeof createSkuSchema>) {
  const parsed = createSkuSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

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

export async function updateSkuConfigAction(input: z.infer<typeof updateSkuConfigSchema>) {
  const parsed = updateSkuConfigSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from('skus')
    .update({
      plant_variety_id: parsed.plantVarietyId,
      size_id: parsed.sizeId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.skuId)
    .eq('org_id', orgId);

  if (error) {
    console.error('[updateSkuConfigAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

async function generateSkuCode(supabase: Awaited<ReturnType<typeof getSupabaseServerApp>>) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Product Mapping Rules Actions
// ─────────────────────────────────────────────────────────────────────────────

const mappingRuleSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  name: z.string().min(1, 'Rule name is required'),
  matchFamily: z.string().nullable().optional(),
  matchGenus: z.string().nullable().optional(),
  matchCategory: z.string().nullable().optional(),
  matchSizeId: z.string().uuid().nullable().optional(),
  matchLocationId: z.string().uuid().nullable().optional(),
  minAgeWeeks: z.number().int().positive().nullable().optional(),
  maxAgeWeeks: z.number().int().positive().nullable().optional(),
  matchStatusIds: z.array(z.string().uuid()).nullable().optional(),
  priority: z.number().int().default(100),
  isActive: z.boolean().default(true),
});

export type MappingRuleInput = z.infer<typeof mappingRuleSchema>;

export async function fetchMappingRulesAction() {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from('product_mapping_rules')
    .select(`
      *,
      product:products(id, name),
      size:plant_sizes(id, name),
      location:nursery_locations(id, name)
    `)
    .eq('org_id', orgId)
    .order('priority', { ascending: true });

  if (error) {
    console.error('[fetchMappingRulesAction]', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data ?? [] };
}

export async function saveMappingRuleAction(input: MappingRuleInput) {
  const parsed = mappingRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Validation failed' };
  }

  const { orgId } = await getUserAndOrg();

  const ruleData = {
    org_id: orgId,
    product_id: parsed.data.productId,
    name: parsed.data.name,
    match_family: parsed.data.matchFamily || null,
    match_genus: parsed.data.matchGenus || null,
    match_category: parsed.data.matchCategory || null,
    match_size_id: parsed.data.matchSizeId || null,
    match_location_id: parsed.data.matchLocationId || null,
    min_age_weeks: parsed.data.minAgeWeeks ?? null,
    max_age_weeks: parsed.data.maxAgeWeeks ?? null,
    match_status_ids: parsed.data.matchStatusIds?.length ? parsed.data.matchStatusIds : null,
    priority: parsed.data.priority,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  };

  // Use admin client to bypass RLS issues with subquery policies
  if (parsed.data.id) {
    // Update existing
    const { error } = await supabaseAdmin
      .from('product_mapping_rules')
      .update(ruleData)
      .eq('id', parsed.data.id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[saveMappingRuleAction] update error', error);
      return { success: false, error: error.message };
    }
  } else {
    // Insert new
    const { error } = await supabaseAdmin
      .from('product_mapping_rules')
      .insert(ruleData);

    if (error) {
      console.error('[saveMappingRuleAction] insert error', error);
      return { success: false, error: error.message };
    }
  }

  revalidatePath('/sales/products/mapping');
  return { success: true };
}

export async function deleteMappingRuleAction(ruleId: string) {
  const { orgId } = await getUserAndOrg();

  // Use admin client to bypass RLS issues
  const { error } = await supabaseAdmin
    .from('product_mapping_rules')
    .delete()
    .eq('id', ruleId)
    .eq('org_id', orgId);

  if (error) {
    console.error('[deleteMappingRuleAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products/mapping');
  return { success: true };
}

export async function runAutoLinkWithRulesAction() {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Fetch active rules
  const { data: rules, error: rulesError } = await supabase
    .from('product_mapping_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (rulesError) {
    console.error('[runAutoLinkWithRulesAction] rules fetch error', rulesError);
    return { success: false, error: rulesError.message, linked: 0 };
  }

  if (!rules?.length) {
    return { success: true, linked: 0, message: 'No active rules configured' };
  }

  // Fetch ALL batches with stock (link at inception, not just available)
  const { data: batches, error: batchError } = await supabase
    .from('batches')
    .select(`
      id,
      plant_variety_id,
      size_id,
      location_id,
      status_id,
      planted_at,
      quantity,
      plant_variety:plant_varieties(id, name, family, genus, category)
    `)
    .eq('org_id', orgId)
    .gt('quantity', 0);

  if (batchError) {
    console.error('[runAutoLinkWithRulesAction] batch fetch error', batchError);
    return { success: false, error: batchError.message, linked: 0 };
  }

  // Fetch existing product_batches to avoid duplicates
  const { data: existingLinks } = await supabase
    .from('product_batches')
    .select('product_id, batch_id');

  const existingSet = new Set(
    (existingLinks ?? []).map(l => `${l.product_id}:${l.batch_id}`)
  );

  let linkedCount = 0;
  const linksToInsert: { org_id: string; product_id: string; batch_id: string }[] = [];

  for (const batch of batches ?? []) {
    const variety = batch.plant_variety as { id: string; name: string; family?: string; genus?: string; category?: string } | null;
    const batchAgeWeeks = batch.planted_at
      ? Math.floor((Date.now() - new Date(batch.planted_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : null;

    // Find first matching rule (rules are ordered by priority)
    for (const rule of rules) {
      // Check family match
      if (rule.match_family && variety?.family?.toLowerCase() !== rule.match_family.toLowerCase()) continue;
      
      // Check genus match
      if (rule.match_genus && variety?.genus?.toLowerCase() !== rule.match_genus.toLowerCase()) continue;
      
      // Check category match
      if (rule.match_category && variety?.category?.toLowerCase() !== rule.match_category.toLowerCase()) continue;
      
      // Check size match
      if (rule.match_size_id && batch.size_id !== rule.match_size_id) continue;
      
      // Check location match
      if (rule.match_location_id && batch.location_id !== rule.match_location_id) continue;
      
      // Check min age
      if (rule.min_age_weeks != null && (batchAgeWeeks == null || batchAgeWeeks < rule.min_age_weeks)) continue;
      
      // Check max age
      if (rule.max_age_weeks != null && (batchAgeWeeks == null || batchAgeWeeks > rule.max_age_weeks)) continue;
      
      // Check status match (if rule specifies specific statuses)
      if (rule.match_status_ids?.length && !rule.match_status_ids.includes(batch.status_id)) continue;

      // All conditions passed - link this batch to the rule's product
      const linkKey = `${rule.product_id}:${batch.id}`;
      if (!existingSet.has(linkKey)) {
        linksToInsert.push({ org_id: orgId, product_id: rule.product_id, batch_id: batch.id });
        existingSet.add(linkKey); // Prevent duplicates within this run
        linkedCount++;
      }
      
      // Only link to first matching rule (highest priority)
      break;
    }
  }

  // Bulk insert new links
  if (linksToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('product_batches')
      .insert(linksToInsert);

    if (insertError) {
      console.error('[runAutoLinkWithRulesAction] insert error', insertError);
      return { success: false, error: insertError.message, linked: 0 };
    }
  }

  revalidatePath('/sales/products/mapping');
  revalidatePath('/sales/products');
  return { success: true, linked: linkedCount };
}

export async function previewRuleMatchesAction(ruleInput: Omit<MappingRuleInput, 'id' | 'productId' | 'name' | 'priority' | 'isActive'>) {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Build query for ALL batches with stock (link at inception)
  let query = supabase
    .from('batches')
    .select(`
      id,
      batch_number,
      quantity,
      planted_at,
      status,
      plant_variety:plant_varieties(id, name, family, genus, category),
      size:plant_sizes(id, name),
      location:nursery_locations(id, name)
    `)
    .eq('org_id', orgId)
    .gt('quantity', 0);

  if (ruleInput.matchSizeId) {
    query = query.eq('size_id', ruleInput.matchSizeId);
  }
  if (ruleInput.matchLocationId) {
    query = query.eq('location_id', ruleInput.matchLocationId);
  }
  if (ruleInput.matchStatusIds?.length) {
    query = query.in('status_id', ruleInput.matchStatusIds);
  }

  const { data: batches, error } = await query.limit(50);

  if (error) {
    console.error('[previewRuleMatchesAction]', error);
    return { success: false, error: error.message, matches: [] };
  }

  // Filter by variety attributes (family, genus, category) in memory
  const matches = (batches ?? []).filter(batch => {
    const variety = batch.plant_variety as { family?: string; genus?: string; category?: string } | null;
    
    if (ruleInput.matchFamily && variety?.family?.toLowerCase() !== ruleInput.matchFamily.toLowerCase()) return false;
    if (ruleInput.matchGenus && variety?.genus?.toLowerCase() !== ruleInput.matchGenus.toLowerCase()) return false;
    if (ruleInput.matchCategory && variety?.category?.toLowerCase() !== ruleInput.matchCategory.toLowerCase()) return false;
    
    // Check age constraints
    if (ruleInput.minAgeWeeks != null || ruleInput.maxAgeWeeks != null) {
      if (!batch.planted_at) return false;
      const ageWeeks = Math.floor((Date.now() - new Date(batch.planted_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (ruleInput.minAgeWeeks != null && ageWeeks < ruleInput.minAgeWeeks) return false;
      if (ruleInput.maxAgeWeeks != null && ageWeeks > ruleInput.maxAgeWeeks) return false;
    }
    
    return true;
  });

  return {
    success: true,
    matches: matches.map(b => ({
      id: b.id,
      batchNumber: b.batch_number,
      quantity: b.quantity,
      status: b.status ?? '',
      varietyName: (b.plant_variety as { name?: string } | null)?.name ?? 'Unknown',
      sizeName: (b.size as { name?: string } | null)?.name ?? '',
      locationName: (b.location as { name?: string } | null)?.name ?? '',
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Varieties Actions
// ─────────────────────────────────────────────────────────────────────────────

const productVarietySchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  varietyId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

export async function addProductVarietyAction(input: z.infer<typeof productVarietySchema>) {
  const parsed = productVarietySchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase.from('product_varieties').insert({
    org_id: orgId,
    product_id: parsed.productId,
    variety_id: parsed.varietyId,
    is_active: parsed.isActive,
  });

  if (error) {
    console.error('[addProductVarietyAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function removeProductVarietyAction(productVarietyId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from('product_varieties').delete().eq('id', productVarietyId);

  if (error) {
    console.error('[removeProductVarietyAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function fetchProductVarietiesAction(productId: string) {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from('product_varieties')
    .select(`
      id,
      product_id,
      variety_id,
      is_active,
      created_at,
      updated_at,
      variety:plant_varieties(id, name, family, genus, category)
    `)
    .eq('org_id', orgId)
    .eq('product_id', productId);

  if (error) {
    console.error('[fetchProductVarietiesAction]', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data ?? [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Groups Actions
// ─────────────────────────────────────────────────────────────────────────────

const productGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().max(500).optional().nullable(),
  defaultBarcode: z.string().max(255).optional().nullable(),
  // Arrays for multi-select
  matchCategories: z.array(z.string()).optional().nullable(),
  matchFamilies: z.array(z.string()).optional().nullable(),
  matchGenera: z.array(z.string()).optional().nullable(),
  matchSizeIds: z.array(z.string().uuid()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ProductGroupInput = z.infer<typeof productGroupSchema>;

export async function fetchProductGroupsAction() {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from('product_groups')
    .select(`
      id,
      name,
      description,
      default_barcode,
      match_category,
      match_family,
      match_genus,
      match_size_ids,
      is_active,
      created_at,
      updated_at
    `)
    .eq('org_id', orgId)
    .order('name');

  if (error) {
    console.error('[fetchProductGroupsAction]', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data ?? [] };
}

export async function upsertProductGroupAction(input: ProductGroupInput) {
  const parsed = productGroupSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  // Convert empty arrays to null
  const cleanArray = <T>(arr: T[] | null | undefined): T[] | null => {
    if (!arr || arr.length === 0) return null;
    return arr;
  };

  const payload = {
    name: parsed.name,
    description: cleanString(parsed.description),
    default_barcode: cleanString(parsed.defaultBarcode),
    match_category: cleanArray(parsed.matchCategories),
    match_family: cleanArray(parsed.matchFamilies),
    match_genus: cleanArray(parsed.matchGenera),
    match_size_ids: cleanArray(parsed.matchSizeIds),
    is_active: parsed.isActive,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (parsed.id) {
    ({ error } = await supabase
      .from('product_groups')
      .update(payload)
      .eq('id', parsed.id)
      .eq('org_id', orgId));
  } else {
    ({ error } = await supabase.from('product_groups').insert({
      ...payload,
      org_id: orgId,
    }));
  }

  if (error) {
    console.error('[upsertProductGroupAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function deleteProductGroupAction(groupId: string) {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from('product_groups')
    .delete()
    .eq('id', groupId)
    .eq('org_id', orgId);

  if (error) {
    console.error('[deleteProductGroupAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function getProductGroupMembersAction(groupId: string) {
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase.rpc('get_product_group_members', {
    p_group_id: groupId,
  });

  if (error) {
    console.error('[getProductGroupMembersAction]', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data ?? [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Group Members Actions (manual include/exclude)
// ─────────────────────────────────────────────────────────────────────────────

const productGroupMemberSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  productId: z.string().uuid(),
  inclusionType: z.enum(['auto', 'manual_include', 'manual_exclude']),
  notes: z.string().max(500).optional().nullable(),
});

export async function upsertProductGroupMemberAction(input: z.infer<typeof productGroupMemberSchema>) {
  const parsed = productGroupMemberSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data: existing } = await supabase
    .from('product_group_members')
    .select('id')
    .eq('group_id', parsed.groupId)
    .eq('product_id', parsed.productId)
    .maybeSingle();

  const payload = {
    inclusion_type: parsed.inclusionType,
    notes: cleanString(parsed.notes),
    updated_at: new Date().toISOString(),
  };

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('product_group_members')
      .update(payload)
      .eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('product_group_members').insert({
      org_id: orgId,
      group_id: parsed.groupId,
      product_id: parsed.productId,
      ...payload,
    }));
  }

  if (error) {
    console.error('[upsertProductGroupMemberAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function removeProductGroupMemberAction(memberId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from('product_group_members').delete().eq('id', memberId);

  if (error) {
    console.error('[removeProductGroupMemberAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Group Aliases Actions
// ─────────────────────────────────────────────────────────────────────────────

const productGroupAliasSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  aliasName: z.string().min(1, 'Alias name is required'),
  customerSkuCode: z.string().max(120).optional().nullable(),
  customerBarcode: z.string().max(255).optional().nullable(),
  unitPriceExVat: z.number().nonnegative().optional().nullable(),
  rrp: z.number().nonnegative().optional().nullable(),
  priceListId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});

export async function fetchProductGroupAliasesAction(groupId: string) {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from('product_group_aliases')
    .select(`
      id,
      group_id,
      customer_id,
      alias_name,
      customer_sku_code,
      customer_barcode,
      unit_price_ex_vat,
      rrp,
      price_list_id,
      is_active,
      notes,
      created_at,
      updated_at,
      customer:customers(id, name),
      price_list:price_lists(id, name)
    `)
    .eq('org_id', orgId)
    .eq('group_id', groupId);

  if (error) {
    console.error('[fetchProductGroupAliasesAction]', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data ?? [] };
}

export async function upsertProductGroupAliasAction(input: z.infer<typeof productGroupAliasSchema>) {
  const parsed = productGroupAliasSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const payload = {
    org_id: orgId,
    group_id: parsed.groupId,
    customer_id: parsed.customerId ?? null,
    alias_name: parsed.aliasName.trim(),
    customer_sku_code: cleanString(parsed.customerSkuCode),
    customer_barcode: cleanString(parsed.customerBarcode),
    unit_price_ex_vat: parsed.unitPriceExVat ?? null,
    rrp: parsed.rrp ?? null,
    price_list_id: parsed.priceListId ?? null,
    is_active: parsed.isActive,
    notes: cleanString(parsed.notes),
    updated_at: new Date().toISOString(),
  };

  let error;
  if (parsed.id) {
    ({ error } = await supabase.from('product_group_aliases').update(payload).eq('id', parsed.id));
  } else {
    ({ error } = await supabase.from('product_group_aliases').insert(payload));
  }

  if (error) {
    console.error('[upsertProductGroupAliasAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

export async function deleteProductGroupAliasAction(aliasId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from('product_group_aliases').delete().eq('id', aliasId);

  if (error) {
    console.error('[deleteProductGroupAliasAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/products');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Item Preferences Actions
// ─────────────────────────────────────────────────────────────────────────────

const orderItemPreferenceSchema = z.object({
  id: z.string().uuid().optional(),
  orderItemId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  varietyId: z.string().uuid().nullable().optional(),
  requestedQty: z.number().int().positive(),
  fulfilledQty: z.number().int().nonnegative().default(0),
  notes: z.string().max(500).optional().nullable(),
});

export async function fetchOrderItemPreferencesAction(orderItemId: string) {
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  const { data, error } = await supabase
    .from('order_item_preferences')
    .select(`
      id,
      order_item_id,
      product_id,
      variety_id,
      requested_qty,
      fulfilled_qty,
      notes,
      created_at,
      updated_at,
      product:products(id, name),
      variety:plant_varieties(id, name)
    `)
    .eq('org_id', orgId)
    .eq('order_item_id', orderItemId);

  if (error) {
    console.error('[fetchOrderItemPreferencesAction]', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data ?? [] };
}

export async function upsertOrderItemPreferenceAction(input: z.infer<typeof orderItemPreferenceSchema>) {
  const parsed = orderItemPreferenceSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  if (!parsed.productId && !parsed.varietyId) {
    return { success: false, error: 'Either productId or varietyId must be provided' };
  }

  const payload = {
    org_id: orgId,
    order_item_id: parsed.orderItemId,
    product_id: parsed.productId ?? null,
    variety_id: parsed.varietyId ?? null,
    requested_qty: parsed.requestedQty,
    fulfilled_qty: parsed.fulfilledQty,
    notes: cleanString(parsed.notes),
    updated_at: new Date().toISOString(),
  };

  let error;
  if (parsed.id) {
    ({ error } = await supabase.from('order_item_preferences').update(payload).eq('id', parsed.id));
  } else {
    ({ error } = await supabase.from('order_item_preferences').insert(payload));
  }

  if (error) {
    console.error('[upsertOrderItemPreferenceAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/orders');
  return { success: true };
}

export async function deleteOrderItemPreferenceAction(preferenceId: string) {
  const supabase = await getSupabaseServerApp();
  const { error } = await supabase.from('order_item_preferences').delete().eq('id', preferenceId);

  if (error) {
    console.error('[deleteOrderItemPreferenceAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/orders');
  return { success: true };
}

export async function updatePreferenceFulfilledQtyAction(preferenceId: string, fulfilledQty: number) {
  const supabase = await getSupabaseServerApp();

  const { error } = await supabase
    .from('order_item_preferences')
    .update({
      fulfilled_qty: fulfilledQty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', preferenceId);

  if (error) {
    console.error('[updatePreferenceFulfilledQtyAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/orders');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk add preferences (for WhatsApp breakdown)
// ─────────────────────────────────────────────────────────────────────────────

const bulkPreferencesSchema = z.object({
  orderItemId: z.string().uuid(),
  preferences: z.array(
    z.object({
      productId: z.string().uuid().nullable().optional(),
      varietyId: z.string().uuid().nullable().optional(),
      requestedQty: z.number().int().positive(),
      notes: z.string().max(500).optional().nullable(),
    })
  ),
});

export async function bulkAddOrderItemPreferencesAction(input: z.infer<typeof bulkPreferencesSchema>) {
  const parsed = bulkPreferencesSchema.parse(input);
  const { orgId } = await getUserAndOrg();
  const supabase = await getSupabaseServerApp();

  for (const pref of parsed.preferences) {
    if (!pref.productId && !pref.varietyId) {
      return { success: false, error: 'Each preference must have either productId or varietyId' };
    }
  }

  // Delete existing preferences for this order item
  await supabase.from('order_item_preferences').delete().eq('order_item_id', parsed.orderItemId);

  // Insert new preferences
  const inserts = parsed.preferences.map((pref) => ({
    org_id: orgId,
    order_item_id: parsed.orderItemId,
    product_id: pref.productId ?? null,
    variety_id: pref.varietyId ?? null,
    requested_qty: pref.requestedQty,
    fulfilled_qty: 0,
    notes: cleanString(pref.notes),
  }));

  const { error } = await supabase.from('order_item_preferences').insert(inserts);

  if (error) {
    console.error('[bulkAddOrderItemPreferencesAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/sales/orders');
  return { success: true };
}

