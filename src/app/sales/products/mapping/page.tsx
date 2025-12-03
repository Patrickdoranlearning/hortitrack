import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { ModulePageHeader } from "@/ui/layout/ModulePageHeader";
import { fetchProductManagementData, mapProducts, buildBatchMappings } from "../product-data";
import ProductBatchMappingClient from "../ProductBatchMappingClient";

export default async function ProductBatchMappingPage() {
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchProductManagementData(supabase, orgId);
  const products = mapProducts(data.productRows);
  const batchMappings = buildBatchMappings(data.productRows, data.batches);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <ModulePageHeader
        title="Batch to Product Mapping"
        description="Control which finished batches feed each sales product."
      />
      <ProductBatchMappingClient batches={batchMappings} products={products} />
    </PageFrame>
  );
}

