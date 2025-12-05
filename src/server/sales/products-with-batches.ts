import { getSupabaseServerApp } from '@/server/db/supabase';

export interface BatchInfo {
  id: string;
  batchNumber: string;
  plantVariety: string;
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

  // Get varieties and sizes
  const varietyIds = skus?.map(s => s.plant_variety_id).filter(Boolean) || [];
  const sizeIds = skus?.map(s => s.size_id).filter(Boolean) || [];

  const [{ data: varieties }, { data: sizes }] = await Promise.all([
    supabase.from('plant_varieties').select('id, name').in('id', varietyIds),
    supabase.from('plant_sizes').select('id, name').in('id', sizeIds),
  ]);

  // Create lookup maps
  const skuMap = new Map(skus?.map(s => [s.id, s]) || []);
  const varietyMap = new Map(varieties?.map(v => [v.id, v.name]) || []);
  const sizeMap = new Map(sizes?.map(s => [s.id, s.name]) || []);

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
    priceItems?.forEach((item: any) => {
      if (item.price_lists?.is_default && item.unit_price_ex_vat != null) {
        defaultPriceMap.set(item.product_id, Number(item.unit_price_ex_vat));
      }
    });
  }

  const aliasMap = new Map<string, ProductAliasInfo[]>();
  aliases?.forEach((alias) => {
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

  // Get all relevant batches (simplified query)
  const batchIds = productBatches?.map(pb => pb.batch_id) || [];

  if (batchIds.length === 0) {
    // No batches linked to products
    return [];
  }

  const { data: batches, error: batchesError } = await supabase
    .from('batches')
    .select('id, batch_number, quantity, status, phase, planted_at, plant_variety_id, size_id, location_id')
    .eq('org_id', orgId)
    .in('id', batchIds)
    .in('status', ['Ready', 'Looking Good'])
    .gt('quantity', 0)
    .order('planted_at', { ascending: true });

  if (batchesError) {
    console.error('Error fetching batches:', batchesError);
    return [];
  }

  // Get locations and QC data separately
  const locationIds = batches?.map(b => b.location_id).filter(Boolean) || [];
  const [{ data: locations }, { data: qcData }] = await Promise.all([
    supabase.from('locations').select('id, name').in('id', locationIds),
    supabase.from('batch_qc').select('batch_id, grade, status').in('batch_id', batchIds),
  ]);

  const locationMap = new Map(locations?.map(l => [l.id, l.name]) || []);
  const qcMap = new Map(qcData?.map(q => [q.batch_id, q]) || []);

  // Create a map of batches by ID for quick lookup
  const batchMap = new Map(
    batches?.map(b => {
      const qc = qcMap.get(b.id);
      return [
        b.id,
        {
          id: b.id,
          batchNumber: b.batch_number || '',
          plantVariety: varietyMap.get(b.plant_variety_id) || '',
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
    const productVariety = varietyMap.get(sku?.plant_variety_id || '') || '';
    const productSize = sizeMap.get(sku?.size_id || '') || '';

    // Ensure each batch has variety and size, falling back to product-level values
    const enrichedBatches = productBatches.map(batch => ({
      ...batch,
      plantVariety: batch.plantVariety || productVariety,
      size: batch.size || productSize,
    }));

    return {
      id: product.id,
      name: product.name || sku?.display_name || 'Unknown Product',
      plantVariety: productVariety,
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

  const { data: batches, error } = await supabase
    .from('batches')
    .select('id, batch_number, quantity, status, phase, planted_at, plant_variety_id, size_id, location_id')
    .eq('org_id', orgId)
    .in('status', ['Ready', 'Looking Good'])
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
  const varietyIds = batches.map(b => b.plant_variety_id).filter(Boolean);
  const sizeIds = batches.map(b => b.size_id).filter(Boolean);
  const locationIds = batches.map(b => b.location_id).filter(Boolean);
  const batchIds = batches.map(b => b.id);

  const [{ data: varieties }, { data: sizes }, { data: locations }, { data: qcData }] = await Promise.all([
    supabase.from('plant_varieties').select('id, name').in('id', varietyIds),
    supabase.from('plant_sizes').select('id, name').in('id', sizeIds),
    supabase.from('locations').select('id, name').in('id', locationIds),
    supabase.from('batch_qc').select('batch_id, grade, status').in('batch_id', batchIds),
  ]);

  const varietyMap = new Map(varieties?.map(v => [v.id, v]) || []);
  const sizeMap = new Map(sizes?.map(s => [s.id, s]) || []);
  const locationMap = new Map(locations?.map(l => [l.id, l.name]) || []);
  const qcMap = new Map(qcData?.map(q => [q.batch_id, q]) || []);

  // Group by variety + size
  const groupedMap = new Map<string, {
    plantVariety: string;
    plantVarietyId: string;
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
      size: size?.name || '',
      quantity: batch.quantity || 0,
      grade: qc?.grade,
      location: locationMap.get(batch.location_id),
      status: batch.status || '',
      plantingDate: batch.planted_at || '',
    });
  });

  return Array.from(groupedMap.values());
}
