import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BOrderCreateClient } from './B2BOrderCreateClient';
import { createClient } from '@/lib/supabase/server';
import type { CustomerCatalogProduct, CustomerCatalogProductWithVarieties, VarietyInfo, VarietyBatchInfo } from '@/lib/b2b/types';
import { calculateVarietyStatus } from '@/lib/b2b/varietyStatus';

export default async function B2BNewOrderPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch customer addresses for delivery selection
  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', authContext.customerId)
    .order('is_default_shipping', { ascending: false });

  // Fetch products filtered by customer's price list
  const { data: productRows } = await supabase
    .from('products')
    .select(`
      id,
      name,
      description,
      hero_image_url,
      is_active,
      sku_id,
      skus (
        id,
        code,
        default_vat_rate,
        plant_variety_id,
        size_id,
        plant_varieties (
          id,
          name,
          family,
          category
        ),
        plant_sizes (
          id,
          name,
          container_type
        )
      ),
      product_batches (
        batch_id,
        batches (
          id,
          batch_number,
          quantity,
          reserved_quantity,
          plant_variety_id,
          growing_status,
          sales_status,
          qc_status,
          notes,
          planted_at,
          nursery_location_id,
          plant_varieties ( name, family ),
          nursery_locations ( name )
        )
      ),
      product_prices!inner (
        price_list_id,
        unit_price_ex_vat,
        currency
      ),
      product_aliases (
        id,
        alias_name,
        customer_sku_code,
        rrp,
        customer_id
      )
    `)
    .eq('org_id', authContext.customer.org_id)
    .eq('is_active', true)
    .eq('product_prices.price_list_id', authContext.customer.default_price_list_id || '')
    .order('name');

  // Transform to catalog format with batch availability and variety aggregation
  const catalogProducts: CustomerCatalogProductWithVarieties[] = (productRows || []).map((row) => {
    const sku = row.skus;
    const variety = sku?.plant_varieties;
    const size = sku?.plant_sizes;

    // Calculate available batches with full batch info
    // Filter to only show saleable batches (sales_status='available', has stock, not rejected)
    const availableBatches = (row.product_batches || [])
      .map((pb) => {
        const batch = pb.batches;
        if (!batch) return null;

        const availableQty = (batch.quantity || 0) - (batch.reserved_quantity || 0);
        if (availableQty <= 0) return null;

        // B2B should only see available batches (not growing, not sold out)
        if (batch.sales_status !== 'available') return null;

        // Filter out rejected batches
        if (batch.qc_status === 'rejected') return null;

        return {
          id: batch.id,
          batchNumber: batch.batch_number || '',
          varietyId: batch.plant_variety_id || null,
          varietyName: batch.plant_varieties?.name || null,
          family: batch.plant_varieties?.family || null,
          availableQty,
          growingStatus: batch.growing_status || null,
          salesStatus: batch.sales_status || null,
          qcStatus: batch.qc_status || null,
          notes: batch.notes || null,
          plantedAt: batch.planted_at || null,
          locationName: batch.nursery_locations?.name || null,
        };
      })
      .filter(Boolean) as VarietyBatchInfo[];

    const totalAvailableQty = availableBatches.reduce((sum, b) => sum + b.availableQty, 0);

    // Group batches by variety for accordion display
    const varietyMap = new Map<string, VarietyInfo>();
    availableBatches.forEach((batch) => {
      if (!batch.varietyId) return; // Skip batches without variety

      const key = batch.varietyId;
      if (!varietyMap.has(key)) {
        varietyMap.set(key, {
          varietyId: batch.varietyId,
          varietyName: batch.varietyName || 'Unknown',
          family: batch.family,
          totalAvailableQty: 0,
          status: 'out', // Will be recalculated
          batchCount: 0,
          batches: [],
        });
      }

      const varietyInfo = varietyMap.get(key)!;
      varietyInfo.totalAvailableQty += batch.availableQty;
      varietyInfo.batchCount += 1;
      varietyInfo.batches.push(batch);
    });

    // Calculate variety-level status for each variety
    varietyMap.forEach((varietyInfo) => {
      varietyInfo.status = calculateVarietyStatus(varietyInfo.batches);
    });

    const varieties = Array.from(varietyMap.values());

    // Get customer-specific alias if exists
    const customerAlias = row.product_aliases?.find((a) => a.customer_id === authContext.customerId);

    // Get price from customer's price list
    const priceEntry = row.product_prices?.[0];

    return {
      productId: row.id,
      productName: row.name,
      description: row.description,
      skuId: sku?.id || '',
      skuCode: sku?.code || null,
      varietyId: variety?.id || null,
      varietyName: variety?.name || null,
      family: variety?.family || null,
      sizeId: size?.id || null,
      sizeName: size?.name || null,
      category: variety?.category || null,
      containerType: size?.container_type || null,
      heroImageUrl: row.hero_image_url,
      isActive: row.is_active ?? true,
      availableBatches: availableBatches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        varietyId: b.varietyId,
        varietyName: b.varietyName,
        family: b.family,
        availableQty: b.availableQty,
      })),
      totalAvailableQty,
      varieties, // NEW: variety-level aggregation for accordion
      priceListId: priceEntry?.price_list_id || null,
      unitPriceExVat: priceEntry?.unit_price_ex_vat || null,
      currency: priceEntry?.currency || 'EUR',
      vatRate: sku?.default_vat_rate || 13.5,
      aliasId: customerAlias?.id || null,
      aliasName: customerAlias?.alias_name || null,
      customerSkuCode: customerAlias?.customer_sku_code || null,
      suggestedRrp: customerAlias?.rrp || null,
    };
  }).filter((p) => p.totalAvailableQty > 0); // Only show products with stock

  // Extract unique categories and sizes for filters
  const categories = Array.from(new Set(catalogProducts.map((p) => p.category).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(catalogProducts.map((p) => p.sizeName).filter(Boolean))) as string[];

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BOrderCreateClient
        products={catalogProducts}
        addresses={addresses || []}
        categories={categories}
        sizes={sizes}
        customerId={authContext.customerId}
      />
    </B2BPortalLayout>
  );
}
