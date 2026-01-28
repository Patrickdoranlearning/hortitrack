import { PageFrame, ModulePageHeader } from '@/ui/templates';
import { getUserAndOrg } from '@/server/auth/org';
import { getProductGroupsWithAvailability } from '@/server/sales/product-groups-with-availability';
import { getProductsWithBatches } from '@/server/sales/products-with-batches';
import { AvailabilityClient } from './AvailabilityClient';

export default async function SalesAvailabilityPage() {
  const { orgId } = await getUserAndOrg();
  
  // Fetch both product groups and products in parallel
  const [productGroups, products] = await Promise.all([
    getProductGroupsWithAvailability(orgId),
    getProductsWithBatches(orgId),
  ]);

  return (
    <PageFrame moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
          title="Stock Availability"
          description="Drill-down view of available stock by Product Group, Product, Variety, and Batch"
        />

        <AvailabilityClient 
          productGroups={productGroups}
          products={products}
        />
      </div>
    </PageFrame>
  );
}
