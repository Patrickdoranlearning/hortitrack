
import Link from "next/link";
import { Plus, Settings2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import ProductManagementClient from "./ProductManagementClient";
import type { ProductManagementPayload } from "./types";
import { fetchProductManagementData, mapProducts } from "./product-data";

export default async function ProductsPage() {
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchProductManagementData(supabase, orgId);

  const payload: ProductManagementPayload = {
    products: mapProducts(data.productRows, data.batches),
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
    plantVarieties: data.plantVarieties,
    plantSizes: data.plantSizes,
  };

  return (
    <PageFrame moduleKey="sales">
      <ModulePageHeader
        title="Products & Pricing"
        description="Manage saleable products, linked batches, and customer-facing price lists."
        actionsSlot={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="sm:size-default">
              <Link href="/sales/products/groups">
                <Layers className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Product Groups</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="sm:size-default">
              <Link href="/sales/products/mapping">
                <Settings2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mapping Rules</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="sm:size-default">
              <Link href="/sales/products/new">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden xs:inline">New</span>
                <span className="hidden sm:inline"> Product</span>
              </Link>
            </Button>
          </div>
        }
      />
      <ProductManagementClient {...payload} />
    </PageFrame>
  );
}
