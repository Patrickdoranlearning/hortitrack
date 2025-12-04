import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { ProductManagementPayload, ProductSummary, BatchMapping } from "./types";

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
    price_list_id: string | null;
    is_active: boolean | null;
    notes: string | null;
    customers: { id: string; name: string } | null;
    price_lists: { id: string; name: string } | null;
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
    plant_varieties?: { id: string; name: string | null; family?: string | null } | null;
    plant_sizes?: { id: string; name: string | null } | null;
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
          price_list_id,
          is_active,
          notes,
          customers ( id, name ),
          price_lists ( id, name )
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
      .in("status", ["Ready for Sale", "Looking Good"])
      .gt("quantity", 0)
      .order("batch_number", { ascending: true })
      .then(async (res) => {
        if (res.error) {
          console.error("[fetchProductManagementData] batches query failed", {
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
                .select("id, name")
                .eq("org_id", orgId)
                .in("id", varietyIds)
            : { data: [], error: null },
          sizeIds.length
            ? supabase.from("plant_sizes").select("id, name").eq("org_id", orgId).in("id", sizeIds)
            : { data: [], error: null },
        ]);

        if (varietiesRes.error) {
          console.warn(
            "[fetchProductManagementData] plant_varieties lookup failed",
            varietiesRes.error
          );
        }
        if (sizesRes.error) {
          console.warn(
            "[fetchProductManagementData] plant_sizes lookup failed",
            sizesRes.error
          );
        }

        const varietyMap = new Map(
          (varietiesRes.data ?? []).map((row) => [row.id, row.name ?? null])
        );
        const sizeMap = new Map((sizesRes.data ?? []).map((row) => [row.id, row.name ?? null]));

        return rows.map((row) => ({
          ...row,
          plant_varieties: { name: varietyMap.get(row.plant_variety_id ?? "") ?? null },
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
  ]);

  return {
    productRows: productRows as ProductRow[],
    skus: skuRows,
    batches: batchRows,
    priceLists: priceListRows,
    customers: customerRows,
    priceListCustomers: priceListCustomerRows,
  };
}

export function mapProducts(rows: ProductRow[]): ProductManagementPayload["products"] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    skuId: row.sku_id,
    description: row.description,
    defaultStatus: row.default_status,
    heroImageUrl: row.hero_image_url,
    isActive: row.is_active ?? true,
    skuVarietyId: row.skus?.plant_variety_id ?? null,
    skuSizeId: row.skus?.size_id ?? null,
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
        priceListId: alias.price_list_id,
        priceListName: alias.price_lists?.name ?? null,
        isActive: alias.is_active ?? true,
        notes: alias.notes,
      })) ?? [],
    batches:
      row.product_batches?.map((pb) => ({
        id: pb.id,
        batchId: pb.batch_id,
        availableQuantityOverride: pb.available_quantity_override,
        batch: pb.batches
          ? {
              id: pb.batches.id,
              batchNumber: pb.batches.batch_number,
              quantity: pb.batches.quantity ?? 0,
              status: pb.batches.status ?? "",
              varietyName: pb.batches.plant_varieties?.name ?? null,
              sizeName: pb.batches.plant_sizes?.name ?? null,
            }
          : null,
      })) ?? [],
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
  }));
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

