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
  reservedForCustomerId?: string | null;
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
  // Order reservations (confirmed orders not yet fulfilled)
  orderReserved: number;
  // Group reservations (orders against product groups this product belongs to)
  groupReserved: number;
  // Net available after all reservations
  netAvailableStock: number;
  batches: BatchInfo[];
  aliases: ProductAliasInfo[];
  defaultPrice: number | null;
  // Computed quantities: product override ?? size default
  shelfQuantity: number | null;
  trolleyQuantity: number | null;
  // Order quantity settings
  minOrderQty: number;
  unitQty: number;
  // Product groups this product belongs to (for display)
  memberOfGroups: string[];
}

/**
 * Fetches all products with their associated batch information for order creation
 * This includes products that are active and have stock available
 * @param orgId - Organization ID
 * @param customerId - Optional customer ID to filter batches (includes unreserved + reserved for this customer)
 */
export async function getProductsWithBatches(orgId: string, customerId?: string | null): Promise<ProductWithBatches[]> {
  const supabase = await getSupabaseServerApp();

  // First, get all active products with quantity overrides, match_families, and match_genera
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, description, is_active, sku_id, shelf_quantity_override, trolley_quantity_override, min_order_qty, unit_qty, match_families, match_genera')
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

  // Get product-batch mappings (explicit links)
  const productIds = products.map(p => p.id);
  const { data: productBatches, error: pbError } = await supabase
    .from('product_batches')
    .select('product_id, batch_id, available_quantity_override')
    .eq('org_id', orgId)
    .in('product_id', productIds);

  if (pbError) {
    console.error('Error fetching product batches:', pbError);
  }

  // First get available status IDs (needed for all batch queries)
  const { data: availableStatuses } = await supabase
    .from('attribute_options')
    .select('id')
    .eq('org_id', orgId)
    .eq('attribute_key', 'production_status')
    .eq('behavior', 'available');

  const availableStatusIds = (availableStatuses ?? []).map(s => s.id);

  // Collect explicit batch IDs from product_batches
  const explicitBatchIds = new Set(productBatches?.map(pb => pb.batch_id) || []);

  // ========== FIX 1: match_families and match_genera auto-linking ==========
  // Products with match_families should auto-link to batches where the variety's family matches
  // Products with match_genera should auto-link to batches where the variety's genus matches
  const productsWithMatchFamilies = products.filter(
    p => p.match_families && (p.match_families as string[]).length > 0
  );
  const productsWithMatchGenera = products.filter(
    p => p.match_genera && (p.match_genera as string[]).length > 0
  );

  // Collect all unique family and genus names (case-insensitive comparison later)
  const allMatchFamilies = new Set<string>();
  productsWithMatchFamilies.forEach(p => {
    (p.match_families as string[]).forEach(f => allMatchFamilies.add(f.toLowerCase()));
  });
  
  const allMatchGenera = new Set<string>();
  productsWithMatchGenera.forEach(p => {
    (p.match_genera as string[]).forEach(g => allMatchGenera.add(g.toLowerCase()));
  });

  // Map to track which batches belong to which families/genera (for auto-linking)
  const familyMatchedBatchMap = new Map<string, Set<string>>(); // family -> batch IDs
  const genusMatchedBatchMap = new Map<string, Set<string>>(); // genus -> batch IDs

  // If we have products with match_families or match_genera, query batches
  if (allMatchFamilies.size > 0 || allMatchGenera.size > 0) {
    // Get the size IDs for products with matching rules (they need to match on size too)
    const matchRuleProductSizeIds = new Set<string>();
    [...productsWithMatchFamilies, ...productsWithMatchGenera].forEach(p => {
      const sku = skuMap.get(p.sku_id);
      if (sku?.size_id) matchRuleProductSizeIds.add(sku.size_id);
    });

    if (matchRuleProductSizeIds.size > 0) {
      // Query all batches with varieties in the matching families/genera and matching sizes
      const { data: matchedBatches, error: matchBatchError } = await supabase
        .from('batches')
        .select(`
          id,
          size_id,
          plant_varieties!inner(family, genus)
        `)
        .eq('org_id', orgId)
        .in('size_id', Array.from(matchRuleProductSizeIds))
        .in('status_id', availableStatusIds.length > 0 ? availableStatusIds : ['00000000-0000-0000-0000-000000000000'])
        .gt('quantity', 0);

      if (matchBatchError) {
        console.error('Error fetching family/genus-matched batches:', matchBatchError);
      }

      // Group batches by family and genus (for quick lookup when building product->batch map)
      matchedBatches?.forEach(b => {
        const variety = b.plant_varieties as { family: string | null; genus: string | null } | null;
        const batchFamily = variety?.family?.toLowerCase();
        const batchGenus = variety?.genus?.toLowerCase();
        
        // Track family matches
        if (batchFamily && allMatchFamilies.has(batchFamily)) {
          if (!familyMatchedBatchMap.has(batchFamily)) {
            familyMatchedBatchMap.set(batchFamily, new Set());
          }
          familyMatchedBatchMap.get(batchFamily)!.add(b.id);
        }
        
        // Track genus matches
        if (batchGenus && allMatchGenera.has(batchGenus)) {
          if (!genusMatchedBatchMap.has(batchGenus)) {
            genusMatchedBatchMap.set(batchGenus, new Set());
          }
          genusMatchedBatchMap.get(batchGenus)!.add(b.id);
        }
      });
    }
  }

  // Combine all batch IDs: explicit links + family-matched + genus-matched
  const allFamilyBatchIds = new Set<string>();
  familyMatchedBatchMap.forEach(batchSet => {
    batchSet.forEach(id => allFamilyBatchIds.add(id));
  });
  
  const allGenusBatchIds = new Set<string>();
  genusMatchedBatchMap.forEach(batchSet => {
    batchSet.forEach(id => allGenusBatchIds.add(id));
  });

  const allBatchIds = new Set([...explicitBatchIds, ...allFamilyBatchIds, ...allGenusBatchIds]);

  if (allBatchIds.size === 0) {
    // No batches linked to products (neither explicit nor family-matched)
    return [];
  }

  // Build batch query with customer reservation filtering
  let batchQuery = supabase
    .from('batches')
    .select('id, batch_number, quantity, reserved_quantity, status, status_id, phase, planted_at, plant_variety_id, size_id, location_id, reserved_for_customer_id')
    .eq('org_id', orgId)
    .in('id', Array.from(allBatchIds))
    .in('status_id', availableStatusIds.length > 0 ? availableStatusIds : ['00000000-0000-0000-0000-000000000000'])
    .gt('quantity', 0);

  // Filter by customer reservation: show unreserved batches OR batches reserved for this customer
  if (customerId) {
    // Customer specified: show unreserved + their reserved batches
    batchQuery = batchQuery.or(`reserved_for_customer_id.is.null,reserved_for_customer_id.eq.${customerId}`);
  } else {
    // No customer specified: show only unreserved batches
    batchQuery = batchQuery.is('reserved_for_customer_id', null);
  }

  const { data: batches, error: batchesError } = await batchQuery.order('planted_at', { ascending: true });

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
      ? supabase.from('plant_varieties').select('id, name, family, genus').in('id', allVarietyIds)
      : Promise.resolve({ data: [] as { id: string; name: string; family: string | null; genus: string | null }[] }),
    allSizeIds.length > 0
      ? supabase.from('plant_sizes').select('id, name, shelf_quantity, trolley_quantity').in('id', allSizeIds)
      : Promise.resolve({ data: [] as { id: string; name: string; shelf_quantity: number | null; trolley_quantity: number | null }[] }),
  ]);
  const varieties = varietiesResult.data;
  const sizes = sizesResult.data;

  // Create lookup maps with complete variety/size data
  const varietyMap = new Map(varieties?.map(v => [v.id, { name: v.name, family: v.family, genus: v.genus }]) || []);
  const sizeMap = new Map(sizes?.map(s => [s.id, {
    name: s.name,
    shelfQuantity: s.shelf_quantity,
    trolleyQuantity: s.trolley_quantity
  }]) || []);

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

  // Fetch order reservations - confirmed orders that reduce availability
  // These are order_items for products that are in active order states
  const activeOrderStatuses = ['confirmed', 'picking', 'packed'];
  const { data: orderReservations, error: orderError } = await supabase
    .from('order_items')
    .select('product_id, quantity, orders!inner(status)')
    .eq('org_id', orgId)
    .in('product_id', productIds)
    .in('orders.status', activeOrderStatuses);

  if (orderError) {
    console.error('Error fetching order reservations:', orderError);
  }

  // Calculate reserved quantity per product from confirmed orders
  const orderReservedMap = new Map<string, number>();
  orderReservations?.forEach((item) => {
    if (item.product_id) {
      const current = orderReservedMap.get(item.product_id) || 0;
      orderReservedMap.set(item.product_id, current + (item.quantity || 0));
    }
  });

  // ========== FIX 2: Group reservations ==========
  // Query product group memberships using the database function
  // Then query order_items with product_group_id to find group-level reservations

  // Get all product groups and their members for this org
  const { data: productGroups, error: groupsError } = await supabase
    .from('product_groups')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (groupsError) {
    console.error('Error fetching product groups:', groupsError);
  }

  // Map to track which groups each product belongs to
  const productGroupMembershipMap = new Map<string, { groupId: string; groupName: string }[]>();

  // Get members for each group using the RPC function
  if (productGroups && productGroups.length > 0) {
    const groupMemberResults = await Promise.all(
      productGroups.map(async (group) => {
        const { data: members, error } = await supabase
          .rpc('get_product_group_members', { p_group_id: group.id });

        if (error) {
          console.error(`Error fetching members for group ${group.id}:`, error);
          return { group, members: [] };
        }
        return {
          group,
          members: members as { product_id: string; product_name: string; inclusion_source: string }[],
        };
      })
    );

    // Build reverse mapping: product -> groups it belongs to
    groupMemberResults.forEach(({ group, members }) => {
      members.forEach((member) => {
        if (!productGroupMembershipMap.has(member.product_id)) {
          productGroupMembershipMap.set(member.product_id, []);
        }
        productGroupMembershipMap.get(member.product_id)!.push({
          groupId: group.id,
          groupName: group.name,
        });
      });
    });
  }

  // Query group-level order reservations
  const groupIds = productGroups?.map((g) => g.id) || [];
  const groupReservedMap = new Map<string, number>(); // groupId -> reserved quantity

  if (groupIds.length > 0) {
    const { data: groupOrderReservations, error: groupOrderError } = await supabase
      .from('order_items')
      .select('product_group_id, quantity, orders!inner(status)')
      .eq('org_id', orgId)
      .in('product_group_id', groupIds)
      .in('orders.status', activeOrderStatuses);

    if (groupOrderError) {
      console.error('Error fetching group order reservations:', groupOrderError);
    }

    groupOrderReservations?.forEach((item) => {
      if (item.product_group_id) {
        const current = groupReservedMap.get(item.product_group_id) || 0;
        groupReservedMap.set(item.product_group_id, current + (item.quantity || 0));
      }
    });
  }

  // Calculate group-level reservations per product
  // A product's group reservation = sum of reservations for all groups it belongs to
  // This is distributed across all products in the group (shown as indicator, not direct reduction)
  const productGroupReservedMap = new Map<string, number>();
  productGroupMembershipMap.forEach((groups, productId) => {
    let totalGroupReserved = 0;
    groups.forEach(({ groupId }) => {
      totalGroupReserved += groupReservedMap.get(groupId) || 0;
    });
    productGroupReservedMap.set(productId, totalGroupReserved);
  });

  // Get locations and QC data separately
  const locationIds = (batches ?? []).map(b => b.location_id).filter((id): id is string => !!id);
  
  let locations: { id: string; name: string }[] = [];
  let qcData: { batch_id: string; grade: string | null; status: string | null }[] = [];
  
  if (locationIds.length > 0) {
    const { data } = await supabase.from('nursery_locations').select('id, name').in('id', locationIds);
    locations = (data as unknown as { id: string; name: string }[]) ?? [];
  }

  if (allBatchIds.size > 0) {
    const { data } = await supabase.from('batch_qc').select('batch_id, grade, status').in('batch_id', Array.from(allBatchIds));
    qcData = (data as unknown as { batch_id: string; grade: string | null; status: string | null }[]) ?? [];
  }

  const locationMap = new Map(locations.map(l => [l.id, l.name]));
  const qcMap = new Map(qcData.map(q => [q.batch_id, q]));

  // Create a map of batches by ID for quick lookup
  // Use available quantity (quantity - reserved_quantity) for stock calculations
  const batchMap = new Map(
    batches?.map(b => {
      const qc = qcMap.get(b.id);
      const variety = varietyMap.get(b.plant_variety_id);
      const availableQty = Math.max(0, (b.quantity || 0) - (b.reserved_quantity || 0));
      return [
        b.id,
        {
          id: b.id,
          batchNumber: b.batch_number || '',
          plantVariety: variety?.name || '',
          family: variety?.family || null,
          size: sizeMap.get(b.size_id)?.name || '',
          quantity: availableQty, // Use available quantity, not total
          grade: qc?.grade,
          location: locationMap.get(b.location_id),
          status: b.status || '',
          plantingDate: b.planted_at || '',
          reservedForCustomerId: b.reserved_for_customer_id || null,
        } as BatchInfo,
      ];
    }) || []
  );

  // Create product-batch mapping, filtering out batches with 0 available quantity
  // Include BOTH explicit product_batches links AND family-matched batches
  const productBatchMap = new Map<string, BatchInfo[]>();

  // First, add explicitly linked batches from product_batches table
  productBatches?.forEach(pb => {
    const batch = batchMap.get(pb.batch_id);
    // Only include batches that have available quantity > 0
    if (batch && batch.quantity > 0) {
      if (!productBatchMap.has(pb.product_id)) {
        productBatchMap.set(pb.product_id, []);
      }
      productBatchMap.get(pb.product_id)!.push(batch);
    }
  });

  // Then, add family-matched batches for products with match_families
  productsWithMatchFamilies.forEach(product => {
    const productMatchFamilies = (product.match_families as string[]).map(f => f.toLowerCase());
    const productSku = skuMap.get(product.sku_id);
    const productSizeId = productSku?.size_id;

    if (!productSizeId) return; // Need size to match

    // Get existing batch IDs for this product to avoid duplicates
    const existingBatchIds = new Set(
      productBatchMap.get(product.id)?.map(b => b.id) || []
    );

    // Find batches that match this product's families AND size
    batches?.forEach(b => {
      // Skip if already linked explicitly
      if (existingBatchIds.has(b.id)) return;

      // Check size matches
      if (b.size_id !== productSizeId) return;

      // Check if batch is in batchMap (has available quantity)
      const batchInfo = batchMap.get(b.id);
      if (!batchInfo || batchInfo.quantity <= 0) return;

      // Check family matches
      const batchFamily = varietyMap.get(b.plant_variety_id)?.family?.toLowerCase();
      if (batchFamily && productMatchFamilies.includes(batchFamily)) {
        if (!productBatchMap.has(product.id)) {
          productBatchMap.set(product.id, []);
        }
        productBatchMap.get(product.id)!.push(batchInfo);
        existingBatchIds.add(b.id); // Track to avoid duplicates
      }
    });
  });

  // Also add genus-matched batches for products with match_genera
  productsWithMatchGenera.forEach(product => {
    const productMatchGenera = (product.match_genera as string[]).map(g => g.toLowerCase());
    const productSku = skuMap.get(product.sku_id);
    const productSizeId = productSku?.size_id;

    if (!productSizeId) return; // Need size to match

    // Get existing batch IDs for this product to avoid duplicates
    const existingBatchIds = new Set(
      productBatchMap.get(product.id)?.map(b => b.id) || []
    );

    // Find batches that match this product's genera AND size
    batches?.forEach(b => {
      // Skip if already linked explicitly or via family
      if (existingBatchIds.has(b.id)) return;

      // Check size matches
      if (b.size_id !== productSizeId) return;

      // Check if batch is in batchMap (has available quantity)
      const batchInfo = batchMap.get(b.id);
      if (!batchInfo || batchInfo.quantity <= 0) return;

      // Check genus matches
      const batchGenus = varietyMap.get(b.plant_variety_id)?.genus?.toLowerCase();
      if (batchGenus && productMatchGenera.includes(batchGenus)) {
        if (!productBatchMap.has(product.id)) {
          productBatchMap.set(product.id, []);
        }
        productBatchMap.get(product.id)!.push(batchInfo);
        existingBatchIds.add(b.id); // Track to avoid duplicates
      }
    });
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
    const sizeData = sizeMap.get(sku?.size_id || '');
    const productSize = sizeData?.name || '';

    // Compute quantities: product override takes precedence over size default
    const shelfQuantity = product.shelf_quantity_override ?? sizeData?.shelfQuantity ?? null;
    const trolleyQuantity = product.trolley_quantity_override ?? sizeData?.trolleyQuantity ?? null;

    // Ensure each batch has variety and size, falling back to product-level values
    const enrichedBatches = productBatches.map(batch => ({
      ...batch,
      plantVariety: batch.plantVariety || productVariety,
      family: batch.family || productFamily,
      size: batch.size || productSize,
    }));

    // Calculate order reserved quantity for this product
    const orderReserved = orderReservedMap.get(product.id) || 0;
    // Group reservations show orders placed against product groups this product belongs to
    const groupReserved = productGroupReservedMap.get(product.id) || 0;
    // Net available accounts for both direct and group reservations
    const netAvailableStock = Math.max(0, totalStock - orderReserved - groupReserved);

    // Get the names of groups this product belongs to
    const memberOfGroups = productGroupMembershipMap.get(product.id)?.map(g => g.groupName) || [];

    return {
      id: product.id,
      name: product.name || sku?.display_name || 'Unknown Product',
      plantVariety: productVariety,
      family: productFamily,
      size: productSize,
      availableStock: totalStock,
      orderReserved,
      groupReserved,
      netAvailableStock,
      batches: enrichedBatches,
      aliases: aliasMap.get(product.id) || [],
      defaultPrice: defaultPriceMap.get(product.id) ?? null,
      shelfQuantity,
      trolleyQuantity,
      minOrderQty: product.min_order_qty ?? 1,
      unitQty: product.unit_qty ?? 1,
      memberOfGroups,
    };
  });

  // Filter out products with no net available stock
  return productsWithBatches.filter(p => p.netAvailableStock > 0);
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
    const { data } = await supabase.from('nursery_locations').select('id, name').in('id', locationIds);
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
