
import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import ProductManagementClient from "./ProductManagementClient";
import type { ProductManagementPayload } from "./types";
import { fetchProductManagementData, mapProducts } from "./product-data";

export default async function ProductsPage() {
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchProductManagementData(supabase, orgId);

  const payload: ProductManagementPayload = {
    products: mapProducts(data.productRows),
    skus: data.skus.map((row) => ({
      id: row.id,
      code: row.code,
      label: row.display_name ? `${row.display_name} • ${row.code}` : row.code,
      plantVarietyId: row.plant_variety_id,
      sizeId: row.size_id,
      defaultVatRate: row.default_vat_rate ?? null,
      displayName: row.display_name ?? null,
    })),
    batches: data.batches.map((row) => ({
      id: row.id,
      label: `#${row.batch_number} • ${row.plant_varieties?.name ?? "Variety"} • ${row.plant_sizes?.name ?? "Size"}`,
      status: row.status ?? "",
      quantity: row.quantity ?? 0,
      varietyId: row.plant_variety_id,
      varietyName: row.plant_varieties?.name ?? null,
      sizeId: row.size_id,
      sizeName: row.plant_sizes?.name ?? null,
    })),
    priceLists: data.priceLists.map((row) => ({
      id: row.id,
      name: row.name,
      currency: row.currency ?? "EUR",
      isDefault: row.is_default ?? false,
    })),
    customers: data.customers.map((row) => ({
      id: row.id,
      name: row.name,
      defaultPriceListId: row.default_price_list_id ?? null,
    })),
    priceListCustomers: data.priceListCustomers.map((row) => ({
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
        actionsSlot={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/sales/products/mapping">
                <Settings2 className="mr-2 h-4 w-4" />
                Mapping Rules
              </Link>
            </Button>
            <Button asChild>
              <Link href="/sales/products/new">
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Link>
            </Button>
          </div>
        }
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
