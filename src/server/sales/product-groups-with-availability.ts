import { getSupabaseServerApp } from '@/server/db/supabase';
import { logError } from '@/lib/log';

export interface ProductGroupChild {
  productId: string;
  productName: string;
  availableStock: number;
  defaultPrice: number | null;
  batches: {
    id: string;
    batchNumber: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    varietyName: string | null;
    location: string | null;
  }[];
}

export interface ProductGroupAlias {
  id: string;
  customerId: string | null;
  aliasName: string;
  unitPriceExVat: number | null;
  rrp: number | null;
  isActive: boolean;
}

export interface ProductGroupWithAvailability {
  id: string;
  name: string;
  description: string | null;
  matchFamily: string[] | null;
  matchSizeIds: string[] | null;
  totalStock: number;           // Sum of all child batch stock (available)
  specificReserved: number;     // Orders against specific children (not batch-allocated)
  genericReserved: number;      // Orders against the group itself
  availableStock: number;       // totalStock - specificReserved - genericReserved
  defaultPrice: number | null;  // First child's price, or null if no children have prices
  aliases: ProductGroupAlias[]; // Customer-specific aliases with pricing
  children: ProductGroupChild[];
}

/**
 * Fetches product groups with full availability calculation.
 *
 * Availability = Sum(child batch stock) - Specific orders - Generic orders
 *
 * Where:
 * - Child batch stock = batch.quantity - batch.reserved_quantity (already allocated)
 * - Specific orders = order_items where product_id = child AND no batch allocations yet
 * - Generic orders = order_items where product_group_id = this group
 *
 * @param orgId - Organization ID
 * @param customerId - Optional customer ID for filtering reserved batches
 */
export async function getProductGroupsWithAvailability(
  orgId: string,
  customerId?: string | null
): Promise<ProductGroupWithAvailability[]> {
  const supabase = await getSupabaseServerApp();

  // 1. Get all active product groups
  const { data: groups, error: groupsError } = await supabase
    .from('product_groups')
    .select('id, name, description, match_family, match_size_ids')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (groupsError) {
    logError('Error fetching product groups', { error: groupsError.message });
    return [];
  }

  if (!groups || groups.length === 0) {
    return [];
  }

  // 1b. Get all aliases for these groups
  const groupIds = groups.map((g) => g.id);
  const { data: allAliases } = await supabase
    .from('product_group_aliases')
    .select('id, group_id, customer_id, alias_name, unit_price_ex_vat, rrp, is_active')
    .in('group_id', groupIds)
    .eq('is_active', true);

  // Create a map of group -> aliases
  const groupAliasesMap = new Map<string, ProductGroupAlias[]>();
  allAliases?.forEach((a) => {
    const groupId = a.group_id;
    if (!groupAliasesMap.has(groupId)) {
      groupAliasesMap.set(groupId, []);
    }
    groupAliasesMap.get(groupId)!.push({
      id: a.id,
      customerId: a.customer_id,
      aliasName: a.alias_name,
      unitPriceExVat: a.unit_price_ex_vat,
      rrp: a.rrp,
      isActive: a.is_active,
    });
  });

  // 2. Get members for ALL groups in a batch query (fix N+1 issue)
  // Get explicit members first
  const { data: explicitMembers } = await supabase
    .from('product_group_members')
    .select('group_id, product_id, products!inner(id, name)')
    .in('group_id', groupIds);

  // Build initial groupMembersMap with explicit members
  const groupMembersMap = new Map<string, { product_id: string; product_name: string }[]>();
  explicitMembers?.forEach((m) => {
    const groupId = m.group_id;
    if (!groupMembersMap.has(groupId)) {
      groupMembersMap.set(groupId, []);
    }
    // Extract product name from the join
    const products = m.products as any;
    const productName = Array.isArray(products) ? products[0]?.name : products?.name;
    groupMembersMap.get(groupId)!.push({
      product_id: m.product_id,
      product_name: productName || 'Unknown',
    });
  });

  // For groups with match_family or match_size_ids, we still need the RPC
  // But we can batch them more efficiently by checking if they have dynamic rules
  const groupsWithDynamicRules = groups.filter(
    (g) => (g.match_family && g.match_family.length > 0) || (g.match_size_ids && g.match_size_ids.length > 0)
  );

  if (groupsWithDynamicRules.length > 0) {
    // Call RPC for groups with dynamic rules
    const dynamicResults = await Promise.all(
      groupsWithDynamicRules.map(async (group) => {
        const { data: members, error } = await supabase
          .rpc('get_product_group_members', { p_group_id: group.id });

        if (error) {
          logError(`Error fetching members for group ${group.id}`, { error: error.message });
          return { groupId: group.id, members: [] };
        }
        return {
          groupId: group.id,
          members: members as { product_id: string; product_name: string; inclusion_source: string }[],
        };
      })
    );

    // Merge dynamic members into the map
    dynamicResults.forEach(({ groupId, members }) => {
      if (!groupMembersMap.has(groupId)) {
        groupMembersMap.set(groupId, []);
      }
      // Merge, avoiding duplicates
      const existing = groupMembersMap.get(groupId)!;
      const existingIds = new Set(existing.map((e) => e.product_id));
      members.forEach((m) => {
        if (!existingIds.has(m.product_id)) {
          existing.push({ product_id: m.product_id, product_name: m.product_name });
        }
      });
    });
  }

  // Collect all unique product IDs
  const allProductIds = new Set<string>();
  groupMembersMap.forEach((members) => {
    members.forEach((m) => allProductIds.add(m.product_id));
  });

  if (allProductIds.size === 0) {
    // No products in any group
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      matchFamily: g.match_family,
      matchSizeIds: g.match_size_ids,
      totalStock: 0,
      specificReserved: 0,
      genericReserved: 0,
      availableStock: 0,
      defaultPrice: null,
      aliases: groupAliasesMap.get(g.id) || [],
      children: [],
    }));
  }

  // 2b. Get product prices for all member products
  const { data: productPrices } = await supabase
    .from('products')
    .select('id, default_price_ex_vat')
    .in('id', Array.from(allProductIds));

  const productPriceMap = new Map<string, number | null>();
  productPrices?.forEach((p) => {
    productPriceMap.set(p.id, p.default_price_ex_vat);
  });

  // 3. Get product-batch mappings for all products
  const { data: productBatches } = await supabase
    .from('product_batches')
    .select('product_id, batch_id')
    .eq('org_id', orgId)
    .in('product_id', Array.from(allProductIds));

  const batchIds = productBatches?.map((pb) => pb.batch_id) || [];

  // 4. Get available status IDs for batch filtering
  const { data: availableStatuses } = await supabase
    .from('attribute_options')
    .select('id')
    .eq('org_id', orgId)
    .eq('attribute_key', 'production_status')
    .eq('behavior', 'available');

  const availableStatusIds = (availableStatuses ?? []).map((s) => s.id);

  // 5. Get batch data
  let batchQuery = supabase
    .from('batches')
    .select('id, batch_number, quantity, reserved_quantity, reserved_for_customer_id, plant_variety_id, location_id')
    .eq('org_id', orgId)
    .in('id', batchIds.length > 0 ? batchIds : ['00000000-0000-0000-0000-000000000000'])
    .in('status_id', availableStatusIds.length > 0 ? availableStatusIds : ['00000000-0000-0000-0000-000000000000'])
    .gt('quantity', 0);

  // Filter by customer reservation
  if (customerId) {
    batchQuery = batchQuery.or(`reserved_for_customer_id.is.null,reserved_for_customer_id.eq.${customerId}`);
  } else {
    batchQuery = batchQuery.is('reserved_for_customer_id', null);
  }

  const { data: batches } = await batchQuery;

  // 5b. Get variety names for batches
  const varietyIds = [...new Set(batches?.map((b) => b.plant_variety_id).filter(Boolean) || [])];
  const { data: varieties } = varietyIds.length > 0
    ? await supabase.from('plant_varieties').select('id, name').in('id', varietyIds)
    : { data: [] };
  const varietyMap = new Map(varieties?.map((v) => [v.id, v.name]) || []);

  // 5c. Get location names for batches
  const locationIds = [...new Set(batches?.map((b) => b.location_id).filter(Boolean) || [])];
  const { data: locations } = locationIds.length > 0
    ? await supabase.from('nursery_locations').select('id, name').in('id', locationIds)
    : { data: [] };
  const locationMap = new Map(locations?.map((l) => [l.id, l.name]) || []);

  // Create batch lookup
  const batchMap = new Map<string, { id: string; batchNumber: string; quantity: number; reservedQuantity: number; varietyName: string | null; location: string | null }>();
  batches?.forEach((b) => {
    batchMap.set(b.id, {
      id: b.id,
      batchNumber: b.batch_number,
      quantity: b.quantity || 0,
      reservedQuantity: b.reserved_quantity || 0,
      varietyName: varietyMap.get(b.plant_variety_id) || null,
      location: locationMap.get(b.location_id) || null,
    });
  });

  // Create product -> batches mapping
  type TransformedBatch = { id: string; batchNumber: string; quantity: number; reservedQuantity: number; varietyName: string | null; location: string | null };
  const productBatchesMap = new Map<string, TransformedBatch[]>();
  productBatches?.forEach((pb) => {
    const batch = batchMap.get(pb.batch_id);
    if (batch) {
      if (!productBatchesMap.has(pb.product_id)) {
        productBatchesMap.set(pb.product_id, []);
      }
      productBatchesMap.get(pb.product_id)!.push(batch);
    }
  });

  // 6. Get order reservations - orders that are confirmed but not fully picked
  // These are orders that will reduce availability
  const activeOrderStatuses = ['confirmed', 'picking', 'packed'];

  // Get specific orders (order_items with product_id matching children)
  const { data: specificOrders } = await supabase
    .from('order_items')
    .select('product_id, quantity, orders!inner(status)')
    .eq('org_id', orgId)
    .in('product_id', Array.from(allProductIds))
    .in('orders.status', activeOrderStatuses);

  // Get generic orders (order_items with product_group_id)
  const { data: genericOrders } = await supabase
    .from('order_items')
    .select('product_group_id, quantity, orders!inner(status)')
    .eq('org_id', orgId)
    .in('product_group_id', groupIds)
    .in('orders.status', activeOrderStatuses);

  // Calculate specific reserved per product
  const specificReservedMap = new Map<string, number>();
  specificOrders?.forEach((item) => {
    if (item.product_id) {
      const current = specificReservedMap.get(item.product_id) || 0;
      specificReservedMap.set(item.product_id, current + (item.quantity || 0));
    }
  });

  // Calculate generic reserved per group
  const genericReservedMap = new Map<string, number>();
  genericOrders?.forEach((item) => {
    if (item.product_group_id) {
      const current = genericReservedMap.get(item.product_group_id) || 0;
      genericReservedMap.set(item.product_group_id, current + (item.quantity || 0));
    }
  });

  // 7. Build result
  const result: ProductGroupWithAvailability[] = groups.map((group) => {
    const members = groupMembersMap.get(group.id) || [];

    // Build children with their availability
    const children: ProductGroupChild[] = members.map((member) => {
      const productBatches = productBatchesMap.get(member.product_id) || [];

      const batchesWithAvailability = productBatches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        reservedQuantity: b.reservedQuantity,
        availableQuantity: Math.max(0, b.quantity - b.reservedQuantity),
        varietyName: b.varietyName,
        location: b.location,
      }));

      const availableStock = batchesWithAvailability.reduce(
        (sum, b) => sum + b.availableQuantity,
        0
      );

      return {
        productId: member.product_id,
        productName: member.product_name,
        availableStock,
        defaultPrice: productPriceMap.get(member.product_id) ?? null,
        batches: batchesWithAvailability,
      };
    });

    // Calculate totals
    const totalStock = children.reduce((sum, c) => sum + c.availableStock, 0);

    // Sum specific reserved across all children in this group
    const specificReserved = members.reduce((sum, m) => {
      return sum + (specificReservedMap.get(m.product_id) || 0);
    }, 0);

    const genericReserved = genericReservedMap.get(group.id) || 0;

    const availableStock = Math.max(0, totalStock - specificReserved - genericReserved);

    // Get the default price from the first child that has a price
    const defaultPrice = children.find((c) => c.defaultPrice != null)?.defaultPrice ?? null;

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      matchFamily: group.match_family,
      matchSizeIds: group.match_size_ids,
      totalStock,
      specificReserved,
      genericReserved,
      availableStock,
      defaultPrice,
      aliases: groupAliasesMap.get(group.id) || [],
      children,
    };
  });

  // Sort by name and filter out groups with no stock
  return result
    .filter((g) => g.children.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a single product group with availability
 */
export async function getProductGroupWithAvailability(
  orgId: string,
  groupId: string,
  customerId?: string | null
): Promise<ProductGroupWithAvailability | null> {
  const groups = await getProductGroupsWithAvailability(orgId, customerId);
  return groups.find((g) => g.id === groupId) || null;
}
