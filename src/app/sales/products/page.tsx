
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import ProductManagementClient, { ProductManagementPayload } from "./ProductManagementClient";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  default_status: string | null;
  hero_image_url: string | null;
  is_active: boolean | null;
  sku_id: string;
  skus: {
    id: string;
    code: string;
    description: string | null;
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
};

export default async function ProductsPage() {
  const { orgId, supabase } = await getUserAndOrg();

  const [{ data: productRows }, { data: skuRows }, { data: batchRows }, { data: priceListRows }, { data: customerRows }, { data: priceListCustomerRows }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          `
          id,
          name,
          description,
          default_status,
          hero_image_url,
          is_active,
          sku_id,
          skus (
            id,
            code,
            description,
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
          )
        `
        )
        .eq("org_id", orgId)
        .order("name", { ascending: true }) as Promise<{ data: ProductRow[] | null; error: any }>,
      supabase
        .from("skus")
        .select(
          `
          id,
          code,
          description,
          plant_varieties ( name ),
          plant_sizes ( name )
        `
        )
        .eq("org_id", orgId)
        .order("code", { ascending: true }),
      supabase
        .from("batches")
        .select(
          `
          id,
          batch_number,
          quantity,
          status,
          plant_varieties ( name ),
          plant_sizes ( name )
        `
        )
        .eq("org_id", orgId)
        .in("status", ["Ready for Sale", "Looking Good", "Finished"])
        .order("batch_number", { ascending: true }),
      supabase.from("price_lists").select("*").eq("org_id", orgId).order("name", { ascending: true }),
      supabase.from("customers").select("id, name, default_price_list_id").eq("org_id", orgId).order("name", { ascending: true }),
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
        .order("created_at", { ascending: false }),
    ]);

  const payload: ProductManagementPayload = {
    products: mapProducts(productRows ?? []),
    skus: (skuRows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      label: `${row.code} • ${row.plant_varieties?.name ?? "Variety"} • ${row.plant_sizes?.name ?? "Size"}`,
    })),
    batches: (batchRows ?? []).map((row) => ({
      id: row.id,
      label: `#${row.batch_number} • ${row.plant_varieties?.name ?? "Variety"} • ${row.plant_sizes?.name ?? "Size"}`,
      status: row.status ?? "",
      quantity: row.quantity ?? 0,
    })),
    priceLists: (priceListRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      currency: row.currency ?? "EUR",
      isDefault: row.is_default ?? false,
    })),
    customers: (customerRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      defaultPriceListId: row.default_price_list_id ?? null,
    })),
    priceListCustomers: (priceListCustomerRows ?? []).map((row) => ({
      id: row.id,
      priceListId: row.price_list_id,
      customerId: row.customer_id,
      priceListName: row.price_lists?.name ?? "Price list",
      customerName: row.customers?.name ?? "Customer",
      validFrom: row.valid_from,
      validTo: row.valid_to,
    })),
  };

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <ModulePageHeader
        title="Products & Pricing"
        description="Manage saleable products, linked batches, and customer-facing price lists."
      />
      <ProductManagementClient {...payload} />
    </PageFrame>
  );
}

function mapProducts(rows: ProductRow[]): ProductManagementPayload["products"] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    skuId: row.sku_id,
    description: row.description,
    defaultStatus: row.default_status,
    heroImageUrl: row.hero_image_url,
    isActive: row.is_active ?? true,
    sku: row.skus
      ? {
          id: row.skus.id,
          code: row.skus.code,
          label: `${row.skus.code} • ${row.skus.plant_varieties?.name ?? "Variety"} • ${
            row.skus.plant_sizes?.name ?? "Size"
          }`,
        }
      : null,
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
