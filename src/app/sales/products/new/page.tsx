import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchProductManagementData, mapProducts } from "../product-data";
import ProductFormClient from "../ProductFormClient";

export default async function NewProductPage() {
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchProductManagementData(supabase, orgId);

  const payload = {
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
  };

  return (
    <PageFrame moduleKey="sales">
      <ModulePageHeader title="Create product" description="Capture merchandising details, inventory, and pricing." />
      {data.skus.length === 0 && (
        <Alert className="mb-6">
          <AlertTitle>No SKUs yet</AlertTitle>
          <AlertDescription>
            Use the “New SKU” button inside the form to create a stock item. Once saved, it will be linked to this product.
          </AlertDescription>
        </Alert>
      )}
      <ProductFormClient mode="create" product={null} {...payload} />
    </PageFrame>
  );
}

