import { getSupabaseServerApp } from '@/server/db/supabase';

export interface BatchInfo {
  id: string;
  batchNumber: string;
  plantVariety: string;
  family?: string | null;
  size: string;
  quantity: number;
  grade?: string;
  location?: string;
  status?: string;
  plantingDate?: string;
}

export interface ProductAliasInfo {
  id: string;
  aliasName: string | null;
  customerId: string | null;
  customerSkuCode: string | null;
  isActive: boolean;
  unitPriceExVat: number | null;
}

export interface ProductWithBatches {
  id: string;
  name: string;
  plantVariety: string;
  family?: string | null;
  size: string;
  availableStock: number;
  batches: BatchInfo[];
  aliases: ProductAliasInfo[];
  defaultPrice: number | null;
}

/**
 * Fetches all products with their associated batch information for order creation
 * This includes products that are active and have stock available
 */
export async function getProductsWithBatches(orgId: string): Promise<ProductWithBatches[]> {
  const supabase = await getSupabaseServerApp();

  // First, get all active products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, description, is_active, sku_id')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return [];
  }

  if (!products || products.length === 0) {
    return [];
  }

  // Get SKUs separately
  const skuIds = products.map(p => p.sku_id).filter(Boolean);
  const { data: skus } = await supabase
    .from('skus')
    .select('id, code, display_name, plant_variety_id, size_id')
    .in('id', skuIds);

  // Create SKU lookup map early
  const skuMap = new Map(skus?.map(s => [s.id, s]) || []);
  
  // Get initial SKU variety and size IDs
  const skuVarietyIds = skus?.map(s => s.plant_variety_id).filter(Boolean) || [];
  const skuSizeIds = skus?.map(s => s.size_id).filter(Boolean) || [];

  // Get product-batch mappings
  const productIds = products.map(p => p.id);
  const { data: productBatches, error: pbError } = await supabase
    .from('product_batches')
    .select('product_id, batch_id, available_quantity_override')
    .eq('org_id', orgId)
    .in('product_id', productIds);

  if (pbError) {
    console.error('Error fetching product batches:', pbError);
  }

  // Get all relevant batches first to collect their variety IDs
  const batchIds = productBatches?.map(pb => pb.batch_id) || [];

  if (batchIds.length === 0) {
    // No batches linked to products
    return [];
  }

  // First get available status IDs
  const { data: availableStatuses } = await supabase
    .from('attribute_options')
    .select('id')
    .eq('org_id', orgId)
    .eq('attribute_key', 'production_status')
    .eq('behavior', 'available');

  const availableStatusIds = (availableStatuses ?? []).map(s => s.id);

  const { data: batches, error: batchesError } = await supabase
    .from('batches')
    .select('id, batch_number, quantity, status, status_id, phase, planted_at, plant_variety_id, size_id, location_id')
    .eq('org_id', orgId)
    .in('id', batchIds)
    .in('status_id', availableStatusIds.length > 0 ? availableStatusIds : ['00000000-0000-0000-0000-000000000000'])
    .gt('quantity', 0)
    .order('planted_at', { ascending: true });

  if (batchesError) {
    console.error('Error fetching batches:', batchesError);
    return [];
  }

  // Collect ALL variety and size IDs from both SKUs AND batches
  const batchVarietyIds = (batches ?? []).map(b => b.plant_variety_id).filter((id): id is string => !!id);
  const batchSizeIds = (batches ?? []).map(b => b.size_id).filter((id): id is string => !!id);
  
  // Combine unique IDs from both sources
  const allVarietyIds = [...new Set([...skuVarietyIds, ...batchVarietyIds])] as string[];
  const allSizeIds = [...new Set([...skuSizeIds, ...batchSizeIds])] as string[];

  // Now fetch varieties and sizes for ALL collected IDs
  const [varietiesResult, sizesResult] = await Promise.all([
    allVarietyIds.length > 0 
      ? supabase.from('plant_varieties').select('id, name, family').in('id', allVarietyIds)
      : Promise.resolve({ data: [] as { id: string; name: string; family: string | null }[] }),
    allSizeIds.length > 0
      ? supabase.from('plant_sizes').select('id, name').in('id', allSizeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const varieties = varietiesResult.data;
  const sizes = sizesResult.data;

  // Create lookup maps with complete variety/size data
  const varietyMap = new Map(varieties?.map(v => [v.id, { name: v.name, family: v.family }]) || []);
  const sizeMap = new Map(sizes?.map(s => [s.id, s.name]) || []);

  // Fetch product aliases for customer filtering
  const { data: aliases, error: aliasError } = await supabase
    .from('product_aliases')
    .select('id, product_id, alias_name, customer_id, customer_sku_code, is_active, unit_price_ex_vat')
    .eq('org_id', orgId)
    .in('product_id', productIds);

  if (aliasError) {
    console.error('Error fetching product aliases:', aliasError);
  }

  // Fetch default prices from product_prices for products (join with price_lists to get default list)
  const defaultPriceMap = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: priceItems, error: priceError } = await supabase
      .from('product_prices')
      .select('product_id, unit_price_ex_vat, price_list_id, price_lists!inner(is_default)')
      .eq('org_id', orgId)
      .in('product_id', productIds);

    if (priceError) {
      console.error('Error fetching price items:', priceError);
    }

    // Create a map of default prices by product
    type PriceItem = {
      product_id: string;
      unit_price_ex_vat: number | null;
      price_lists: { is_default: boolean } | null;
    };
    (priceItems as PriceItem[] | null)?.forEach((item) => {
      if (item.price_lists?.is_default && item.unit_price_ex_vat != null) {
        defaultPriceMap.set(item.product_id, Number(item.unit_price_ex_vat));
      }
    });
  }

  const aliasMap = new Map<string, ProductAliasInfo[]>();
  aliases?.forEach((alias) => {
    if (!alias.product_id) return;
    const list = aliasMap.get(alias.product_id) || [];
    list.push({
      id: alias.id,
      aliasName: alias.alias_name ?? null,
      customerId: alias.customer_id ?? null,
      customerSkuCode: alias.customer_sku_code ?? null,
      isActive: alias.is_active ?? true,
      unitPriceExVat: alias.unit_price_ex_vat ?? null,
    });
    aliasMap.set(alias.product_id, list);
  });

  // Get locations and QC data separately
  const locationIds = (batches ?? []).map(b => b.location_id).filter((id): id is string => !!id);
  
  let locations: { id: string; name: string }[] = [];
  let qcData: { batch_id: string; grade: string | null; status: string | null }[] = [];
  
  if (locationIds.length > 0) {
    const { data } = await supabase.from('locations').select('id, name').in('id', locationIds);
    locations = (data as unknown as { id: string; name: string }[]) ?? [];
  }

  if (batchIds.length > 0) {
    const { data } = await supabase.from('batch_qc').select('batch_id, grade, status').in('batch_id', batchIds);
    qcData = (data as unknown as { batch_id: string; grade: string | null; status: string | null }[]) ?? [];
  }

  const locationMap = new Map(locations.map(l => [l.id, l.name]));
  const qcMap = new Map(qcData.map(q => [q.batch_id, q]));

  // Create a map of batches by ID for quick lookup
  const batchMap = new Map(
    batches?.map(b => {
      const qc = qcMap.get(b.id);
      const variety = varietyMap.get(b.plant_variety_id);
      return [
        b.id,
        {
          id: b.id,
          batchNumber: b.batch_number || '',
          plantVariety: variety?.name || '',
          family: variety?.family || null,
          size: sizeMap.get(b.size_id) || '',
          quantity: b.quantity || 0,
          grade: qc?.grade,
          location: locationMap.get(b.location_id),
          status: b.status || '',
          plantingDate: b.planted_at || '',
        } as BatchInfo,
      ];
    }) || []
  );

  // Create product-batch mapping
  const productBatchMap = new Map<string, BatchInfo[]>();
  productBatches?.forEach(pb => {
    const batch = batchMap.get(pb.batch_id);
    if (batch) {
      if (!productBatchMap.has(pb.product_id)) {
        productBatchMap.set(pb.product_id, []);
      }
      productBatchMap.get(pb.product_id)!.push(batch);
    }
  });

  // Transform products with their batches
  const productsWithBatches: ProductWithBatches[] = products.map(product => {
    const sku = skuMap.get(product.sku_id);
    const productBatches = productBatchMap.get(product.id) || [];
    const totalStock = productBatches.reduce((sum, b) => sum + b.quantity, 0);

    // Get product-level variety and size from SKU
    const skuVariety = varietyMap.get(sku?.plant_variety_id || '');
    const productVariety = skuVariety?.name || '';
    const productFamily = skuVariety?.family || null;
    const productSize = sizeMap.get(sku?.size_id || '') || '';

    // Ensure each batch has variety and size, falling back to product-level values
    const enrichedBatches = productBatches.map(batch => ({
      ...batch,
      plantVariety: batch.plantVariety || productVariety,
      family: batch.family || productFamily,
      size: batch.size || productSize,
    }));

    return {
      id: product.id,
      name: product.name || sku?.display_name || 'Unknown Product',
      plantVariety: productVariety,
      family: productFamily,
      size: productSize,
      availableStock: totalStock,
      batches: enrichedBatches,
      aliases: aliasMap.get(product.id) || [],
      defaultPrice: defaultPriceMap.get(product.id) ?? null,
    };
  });

  // Filter out products with no stock
  return productsWithBatches.filter(p => p.availableStock > 0);
}

/**
 * Alternative: Get products grouped by variety and size with all available batches
 * This is useful for the order form when customers don't care about specific products
 */
export async function getVarietiesWithBatches(orgId: string) {
  const supabase = await getSupabaseServerApp();

  // First get available status IDs
  const { data: availableStatuses } = await supabase
    .from('attribute_options')
    .select('id')
    .eq('org_id', orgId)
    .eq('attribute_key', 'production_status')
    .eq('behavior', 'available');

  const availableStatusIds = (availableStatuses ?? []).map(s => s.id);

  const { data: batches, error } = await supabase
    .from('batches')
    .select('id, batch_number, quantity, status, status_id, phase, planted_at, plant_variety_id, size_id, location_id')
    .eq('org_id', orgId)
    .in('status_id', availableStatusIds.length > 0 ? availableStatusIds : ['00000000-0000-0000-0000-000000000000'])
    .gt('quantity', 0)
    .order('planted_at', { ascending: true });

  if (error) {
    console.error('Error fetching varieties with batches:', error);
    return [];
  }

  if (!batches || batches.length === 0) {
    return [];
  }

  // Get varieties, sizes, locations, and QC data separately
  const varietyIds = batches.map(b => b.plant_variety_id).filter((id): id is string => !!id);
  const sizeIds = batches.map(b => b.size_id).filter((id): id is string => !!id);
  const locationIds = batches.map(b => b.location_id).filter((id): id is string => !!id);
  const batchIds = batches.map(b => b.id);

  // Fetch related data
  let varieties: { id: string; name: string; family: string | null }[] = [];
  let sizes: { id: string; name: string }[] = [];
  let locations: { id: string; name: string }[] = [];
  let qcData: { batch_id: string; grade: string | null; status: string | null }[] = [];

  if (varietyIds.length > 0) {
    const { data } = await supabase.from('plant_varieties').select('id, name, family').in('id', varietyIds);
    varieties = (data as unknown as { id: string; name: string; family: string | null }[]) ?? [];
  }
  if (sizeIds.length > 0) {
    const { data } = await supabase.from('plant_sizes').select('id, name').in('id', sizeIds);
    sizes = (data as unknown as { id: string; name: string }[]) ?? [];
  }
  if (locationIds.length > 0) {
    const { data } = await supabase.from('locations').select('id, name').in('id', locationIds);
    locations = (data as unknown as { id: string; name: string }[]) ?? [];
  }
  if (batchIds.length > 0) {
    const { data } = await supabase.from('batch_qc').select('batch_id, grade, status').in('batch_id', batchIds);
    qcData = (data as unknown as { batch_id: string; grade: string | null; status: string | null }[]) ?? [];
  }

  const varietyMap = new Map(varieties.map(v => [v.id, { id: v.id, name: v.name, family: v.family }]));
  const sizeMap = new Map(sizes.map(s => [s.id, s]));
  const locationMap = new Map(locations.map(l => [l.id, l.name]));
  const qcMap = new Map(qcData.map(q => [q.batch_id, q]));

  // Group by variety + size
  const groupedMap = new Map<string, {
    plantVariety: string;
    plantVarietyId: string;
    family: string | null;
    size: string;
    sizeId: string;
    totalQuantity: number;
    batches: BatchInfo[];
  }>();

  batches?.forEach(batch => {
    const variety = varietyMap.get(batch.plant_variety_id);
    const size = sizeMap.get(batch.size_id);
    const qc = qcMap.get(batch.id);
    const key = `${batch.plant_variety_id || 'unknown'}-${batch.size_id || 'unknown'}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        plantVariety: variety?.name || '',
        plantVarietyId: variety?.id || '',
        family: variety?.family || null,
        size: size?.name || '',
        sizeId: size?.id || '',
        totalQuantity: 0,
        batches: [],
      });
    }

    const group = groupedMap.get(key)!;
    group.totalQuantity += batch.quantity || 0;
    group.batches.push({
      id: batch.id,
      batchNumber: batch.batch_number || '',
      plantVariety: variety?.name || '',
      family: variety?.family || null,
      size: size?.name || '',
      quantity: batch.quantity || 0,
      grade: qc?.grade ?? undefined,
      location: locationMap.get(batch.location_id),
      status: batch.status || '',
      plantingDate: batch.planted_at || '',
    });
  });

  return Array.from(groupedMap.values());
}
