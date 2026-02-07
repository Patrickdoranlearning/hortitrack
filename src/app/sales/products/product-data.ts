import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ProductManagementPayload, ProductSummary, BatchMapping } from "./types";
import { logError, logWarning } from "@/lib/log";

type SupabaseServerClient = SupabaseClient<Database>;

export type ProductRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  default_status: string | null;
  hero_image_url: string | null;
  is_active: boolean | null;
  sku_id: string;
  shelf_quantity_override: number | null;
  trolley_quantity_override: number | null;
  min_order_qty: number | null;
  unit_qty: number | null;
  match_families: string[] | null;
  match_genera: string[] | null;
  skus: {
    id: string;
    code: string;
    display_name: string | null;
    description: string | null;
    barcode: string | null;
    default_vat_rate: number | null;
    plant_variety_id: string | null;
    size_id: string | null;
    plant_varieties?: { name: string | null } | null;
    plant_sizes?: { name: string | null } | null;
  } | null;
  product_batches: Array<{
    id: string;
    batch_id: string;
    available_quantity_override: number | null;
    batches: {
      id: string;
      batch_number: string;
      quantity: number | null;
      status: string | null;
      status_id: string | null;
      attribute_options?: { behavior: string | null } | null;
      plant_varieties?: { name: string | null } | null;
      plant_sizes?: { name: string | null } | null;
    } | null;
  }> | null;
  product_prices: Array<{
    id: string;
    price_list_id: string;
    unit_price_ex_vat: number;
    currency: string;
    min_qty: number;
    valid_from: string | null;
    valid_to: string | null;
    price_lists: { id: string; name: string } | null;
  }> | null;
  product_aliases: Array<{
    id: string;
    customer_id: string | null;
    alias_name: string;
    customer_sku_code: string | null;
    customer_barcode: string | null;
    unit_price_ex_vat: number | null;
    rrp: number | null;
    price_list_id: string | null;
    is_active: boolean | null;
    notes: string | null;
    customers: { id: string; name: string } | null;
    price_lists: { id: string; name: string } | null;
  }> | null;
  product_varieties: Array<{
    id: string;
    variety_id: string;
    is_active: boolean | null;
    plant_varieties: { id: string; name: string; family: string | null; genus: string | null } | null;
  }> | null;
};

export type ProductManagementData = {
  productRows: ProductRow[];
  skus: Array<{
    id: string;
    code: string;
    display_name: string | null;
    description: string | null;
    plant_variety_id: string | null;
    size_id: string | null;
    default_vat_rate: number | null;
    plant_varieties?: { name: string | null } | null;
    plant_sizes?: { name: string | null } | null;
  }>;
  batches: Array<{
    id: string;
    batch_number: string;
    quantity: number | null;
    status: string | null;
    plant_variety_id: string | null;
    size_id: string | null;
    plant_varieties?: { name: string | null; family: string | null; genus: string | null } | null;
    plant_sizes?: { name: string | null } | null;
  }>;
  priceLists: Array<{ id: string; name: string; currency: string; is_default: boolean | null }>;
  customers: Array<{ id: string; name: string; default_price_list_id: string | null }>;
  priceListCustomers: Array<{
    id: string;
    price_list_id: string;
    customer_id: string;
    valid_from: string | null;
    valid_to: string | null;
    price_lists: { id: string; name: string } | null;
    customers: { id: string; name: string } | null;
  }>;
  plantVarieties: Array<{ id: string; name: string; family: string | null; genus: string | null }>;
  plantSizes: Array<{ id: string; name: string }>;
};

export async function fetchProductManagementData(
  supabase: SupabaseServerClient,
  orgId: string
): Promise<ProductManagementData> {
  const [
    productRows,
    skuRows,
    batchRows,
    priceListRows,
    customerRows,
    priceListCustomerRows,
    plantVarietyRows,
    plantSizeRows,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        `
        *,
        skus (
          id,
          code,
          display_name,
          description,
          barcode,
          default_vat_rate,
          plant_variety_id,
          size_id,
          plant_varieties ( name ),
          plant_sizes ( name )
        ),
        product_batches (
          id,
          batch_id,
          available_quantity_override,
          batches (
            id,
            batch_number,
            quantity,
            status,
            status_id,
            attribute_options ( behavior ),
            plant_varieties ( name ),
            plant_sizes ( name )
          )
        ),
        product_prices (
          id,
          price_list_id,
          unit_price_ex_vat,
          currency,
          min_qty,
          valid_from,
          valid_to,
          price_lists ( id, name )
        ),
        product_aliases (
          id,
          customer_id,
          alias_name,
          customer_sku_code,
          customer_barcode,
          unit_price_ex_vat,
          rrp,
          price_list_id,
          is_active,
          notes,
          customers ( id, name ),
          price_lists ( id, name )
        ),
        product_varieties (
          id,
          variety_id,
          is_active,
          plant_varieties ( id, name, family, genus )
        )
      `
      )
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
    supabase
      .from("skus")
      .select(
        `
        id,
        code,
        display_name,
        description,
        barcode,
        default_vat_rate,
        plant_variety_id,
        size_id,
        plant_varieties ( name ),
        plant_sizes ( name )
      `
      )
      .eq("org_id", orgId)
      .order("code", { ascending: true })
      .then((res) => res.data ?? []),
    supabase
      .from("batches")
      .select(
        `
        id,
        batch_number,
        quantity,
        status,
        plant_variety_id,
        size_id
      `
      )
      .eq("org_id", orgId)
      .gt("quantity", 0)
      .order("batch_number", { ascending: true })
      .then(async (res) => {
        if (res.error) {
          logError("[fetchProductManagementData] batches query failed", {
            message: res.error.message,
            details: res.error.details,
            hint: res.error.hint,
            code: res.error.code,
          });
          return [];
        }
        const rows = res.data ?? [];
        if (rows.length === 0) return [];

        const varietyIds = Array.from(
          new Set(rows.map((row) => row.plant_variety_id).filter(Boolean))
        ) as string[];
        const sizeIds = Array.from(
          new Set(rows.map((row) => row.size_id).filter(Boolean))
        ) as string[];

        const [varietiesRes, sizesRes] = await Promise.all([
          varietyIds.length
            ? supabase
                .from("plant_varieties")
                .select("id, name, family, genus")
                .eq("org_id", orgId)
                .in("id", varietyIds)
            : { data: [], error: null },
          sizeIds.length
            ? supabase.from("plant_sizes").select("id, name").in("id", sizeIds)
            : { data: [], error: null },
        ]);

        if (varietiesRes.error) {
          logWarning(
            "[fetchProductManagementData] plant_varieties lookup failed",
            { error: varietiesRes.error.message }
          );
        }
        if (sizesRes.error) {
          logWarning(
            "[fetchProductManagementData] plant_sizes lookup failed",
            { error: sizesRes.error.message }
          );
        }

        const varietyMap = new Map(
          (varietiesRes.data ?? []).map((row) => [row.id, { name: row.name ?? null, family: row.family ?? null, genus: row.genus ?? null }])
        );
        const sizeMap = new Map((sizesRes.data ?? []).map((row) => [row.id, row.name ?? null]));

        return rows.map((row) => ({
          ...row,
          plant_varieties: varietyMap.get(row.plant_variety_id ?? "") ?? { name: null, family: null, genus: null },
          plant_sizes: { name: sizeMap.get(row.size_id ?? "") ?? null },
        }));
      }),
    supabase.from("price_lists").select("*").eq("org_id", orgId).order("name", { ascending: true }).then((res) => res.data ?? []),
    supabase
      .from("customers")
      .select("id, name, default_price_list_id")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
    supabase
      .from("price_list_customers")
      .select(
        `
        id,
        price_list_id,
        customer_id,
        valid_from,
        valid_to,
        price_lists ( id, name ),
        customers ( id, name )
      `
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .then((res) => res.data ?? []),
    supabase
      .from("plant_varieties")
      .select("id, name, family, genus")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
    supabase
      .from("plant_sizes")
      .select("id, name")
      .order("name", { ascending: true })
      .then((res) => res.data ?? []),
  ]);

  return {
    productRows: productRows as ProductRow[],
    skus: skuRows,
    batches: batchRows,
    priceLists: priceListRows,
    customers: customerRows,
    priceListCustomers: priceListCustomerRows,
    plantVarieties: plantVarietyRows.map((v) => ({ id: v.id, name: v.name ?? "", family: v.family ?? null, genus: v.genus ?? null })),
    plantSizes: plantSizeRows.map((s) => ({ id: s.id, name: s.name ?? "" })),
  };
}

export function mapProducts(
  rows: ProductRow[],
  allBatches: ProductManagementData["batches"] = []
): ProductManagementPayload["products"] {
  return rows.map((row) => {
    // 1. Start with manually linked batches
    const linkedBatches = row.product_batches?.map((pb) => ({
      id: pb.id,
      batchId: pb.batch_id,
      availableQuantityOverride: pb.available_quantity_override,
      batch: pb.batches
        ? {
            id: pb.batches.id,
            batchNumber: pb.batches.batch_number,
            quantity: pb.batches.quantity ?? 0,
            status: pb.batches.status ?? "",
            behavior: pb.batches.attribute_options?.behavior ?? null,
            varietyName: pb.batches.plant_varieties?.name ?? null,
            sizeName: pb.batches.plant_sizes?.name ?? null,
          }
        : null,
    })) ?? [];

    // Create a Set of already-linked batch IDs and a mutable merged array
    const linkedBatchIds = new Set(linkedBatches.map((lb) => lb.batchId));
    const mergedBatches = [...linkedBatches];

    // 2. Add family-matched batches if configured
    if (row.match_families && row.match_families.length > 0 && row.skus?.size_id) {
      const matchFamilies = row.match_families.map((f) => f.toLowerCase());
      const skuSizeId = row.skus.size_id;

      // Filter from allBatches
      const matchingBatches = allBatches.filter((b) => {
        // Must match size
        if (b.size_id !== skuSizeId) return false;
        // Must match family (case-insensitive)
        const family = b.plant_varieties?.family?.toLowerCase();
        return family && matchFamilies.includes(family);
      });

      // Add to merged list if not already linked
      for (const batch of matchingBatches) {
        if (!linkedBatchIds.has(batch.id)) {
          mergedBatches.push({
            id: `dynamic-${row.id}-${batch.id}`, // Virtual ID for the link
            batchId: batch.id,
            availableQuantityOverride: null,
            batch: {
              id: batch.id,
              batchNumber: batch.batch_number,
              quantity: batch.quantity ?? 0,
              status: batch.status ?? "",
              behavior: null,
              varietyName: batch.plant_varieties?.name ?? null,
              sizeName: batch.plant_sizes?.name ?? null,
            },
          });
          linkedBatchIds.add(batch.id);
        }
      }
    }

    // 3. Add genus-matched batches if configured (more precise than family)
    if (row.match_genera && row.match_genera.length > 0 && row.skus?.size_id) {
      const matchGenera = row.match_genera.map((g) => g.toLowerCase());
      const skuSizeId = row.skus.size_id;

      // Filter from allBatches
      const matchingBatches = allBatches.filter((b) => {
        // Must match size
        if (b.size_id !== skuSizeId) return false;
        // Must match genus (case-insensitive)
        const genus = b.plant_varieties?.genus?.toLowerCase();
        return genus && matchGenera.includes(genus);
      });

      // Add to merged list if not already linked (may already be linked by family or explicit)
      for (const batch of matchingBatches) {
        if (!linkedBatchIds.has(batch.id)) {
          mergedBatches.push({
            id: `dynamic-genus-${row.id}-${batch.id}`, // Virtual ID for the link
            batchId: batch.id,
            availableQuantityOverride: null,
            batch: {
              id: batch.id,
              batchNumber: batch.batch_number,
              quantity: batch.quantity ?? 0,
              status: batch.status ?? "",
              behavior: null,
              varietyName: batch.plant_varieties?.name ?? null,
              sizeName: batch.plant_sizes?.name ?? null,
            },
          });
          linkedBatchIds.add(batch.id);
        }
      }
    }

    return {
      id: row.id,
      name: row.name,
      skuId: row.sku_id,
      description: row.description,
      defaultStatus: row.default_status,
      heroImageUrl: row.hero_image_url,
      isActive: row.is_active ?? true,
      skuVarietyId: row.skus?.plant_variety_id ?? null,
      skuSizeId: row.skus?.size_id ?? null,
      shelfQuantityOverride: row.shelf_quantity_override ?? null,
      trolleyQuantityOverride: row.trolley_quantity_override ?? null,
      minOrderQty: row.min_order_qty ?? 1,
      unitQty: row.unit_qty ?? 1,
      matchFamilies: row.match_families ?? null,
      matchGenera: row.match_genera ?? null,
      varieties:
        row.product_varieties?.map((pv) => ({
          id: pv.id,
          productId: row.id,
          varietyId: pv.variety_id,
          isActive: pv.is_active ?? true,
          createdAt: "",
          updatedAt: "",
          variety: pv.plant_varieties
            ? {
                id: pv.plant_varieties.id,
                name: pv.plant_varieties.name,
                family: pv.plant_varieties.family,
                genus: pv.plant_varieties.genus,
                category: null,
              }
            : null,
        })) ?? [],
      sku: row.skus
        ? {
            id: row.skus.id,
            code: row.skus.code,
            label: row.skus.display_name
              ? `${row.skus.display_name} • ${row.skus.code}`
              : row.skus.code,
            displayName: row.skus.display_name ?? null,
          }
        : null,
      aliases:
        row.product_aliases?.map((alias) => ({
          id: alias.id,
          aliasName: alias.alias_name,
          customerId: alias.customer_id,
          customerName: alias.customers?.name ?? null,
          customerSkuCode: alias.customer_sku_code,
          customerBarcode: alias.customer_barcode,
          unitPriceExVat: alias.unit_price_ex_vat,
          rrp: alias.rrp,
          priceListId: alias.price_list_id,
          priceListName: alias.price_lists?.name ?? null,
          isActive: alias.is_active ?? true,
          notes: alias.notes,
        })) ?? [],
      batches: mergedBatches,
      prices:
        row.product_prices?.map((price) => ({
          id: price.id,
          priceListId: price.price_list_id,
          priceListName: price.price_lists?.name ?? "Price list",
          unitPriceExVat: price.unit_price_ex_vat,
          currency: price.currency ?? "EUR",
          minQty: price.min_qty ?? 1,
          validFrom: price.valid_from,
          validTo: price.valid_to,
        })) ?? [],
    };
  });
}

export function findProductById(products: ProductSummary[], productId: string) {
  return products.find((product) => product.id === productId) ?? null;
}

export function buildBatchMappings(productRows: ProductRow[], batchRows: ProductManagementData["batches"]): BatchMapping[] {
  const batchLinks = new Map<string, Array<{ productId: string; productName: string; productBatchId: string }>>();

  for (const product of productRows) {
    if (!product.product_batches) continue;
    for (const pb of product.product_batches) {
      if (!pb.batch_id) continue;
      const list = batchLinks.get(pb.batch_id) ?? [];
      list.push({
        productId: product.id,
        productName: product.name,
        productBatchId: pb.id,
      });
      batchLinks.set(pb.batch_id, list);
    }
  }

  return batchRows.map((batch) => ({
    id: batch.id,
    batchNumber: batch.batch_number,
    varietyName: batch.plant_varieties?.name ?? null,
    sizeName: batch.plant_sizes?.name ?? null,
    quantity: batch.quantity ?? 0,
    status: batch.status ?? "Unknown",
    plantVarietyId: batch.plant_variety_id ?? null,
    sizeId: batch.size_id ?? null,
    linkedProducts: batchLinks.get(batch.id) ?? [],
  }));
}

