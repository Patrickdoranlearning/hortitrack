import { notFound } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import ProductFormClient from "../ProductFormClient";
import { fetchProductManagementData, mapProducts } from "../product-data";

type Params = { productId: string };

export default async function ProductEditPage({ params }: { params: Params }) {
  const { productId } = params;
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchProductManagementData(supabase, orgId);
  const products = mapProducts(data.productRows);
  const product = products.find((p) => p.id === productId);

  if (!product) {
    notFound();
  }

  const payload = {
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
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <ModulePageHeader
        title={`Edit ${product.name}`}
        description="Update merchandising details, linked batches, and pricing."
      />
      <ProductFormClient mode="edit" product={product} {...payload} />
    </PageFrame>
  );
}

