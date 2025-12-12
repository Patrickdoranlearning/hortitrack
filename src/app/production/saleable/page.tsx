import { Metadata } from "next";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { fetchSaleableBatches, fetchLocations, fetchVarieties, fetchProductionStatusOptions, SALEABLE_STATUSES } from "@/server/production/saleable";
import SaleableBatchesClient from "./SaleableBatchesClient";

export const metadata: Metadata = {
  title: "Batch Availability | Production",
};

type PageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function SaleableBatchesPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const { orgId } = await getUserAndOrg();
  const statusFilter = searchParams?.status
    ? searchParams.status.split(",").filter(Boolean)
    : undefined;

  // Fetch batches, locations, varieties and status options in parallel
  // Show ALL batches by default so the user can manage any batch's status
  const [batches, locations, varieties, statusOptions] = await Promise.all([
    fetchSaleableBatches(orgId, { showAll: true }),
    fetchLocations(orgId),
    fetchVarieties(orgId),
    fetchProductionStatusOptions(orgId),
  ]);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <SaleableBatchesClient
        initialBatches={batches}
        productionStatusOptions={statusOptions}
        defaultStatuses={statusFilter && statusFilter.length > 0 ? statusFilter : [...SALEABLE_STATUSES]}
        locations={locations}
        varieties={varieties}
      />
    </PageFrame>
  );
}

