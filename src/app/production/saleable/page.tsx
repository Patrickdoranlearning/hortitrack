import { Metadata } from "next";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import { fetchSaleableBatches, SALEABLE_STATUSES } from "@/server/production/saleable";
import SaleableBatchesClient from "./SaleableBatchesClient";

export const metadata: Metadata = {
  title: "Saleable Batches | Production",
};

type PageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function SaleableBatchesPage({ searchParams }: PageProps) {
  const { orgId } = await getUserAndOrg();
  const statusFilter = searchParams?.status
    ? searchParams.status.split(",").filter(Boolean)
    : undefined;

  const batches = await fetchSaleableBatches(orgId, {
    statuses: statusFilter,
  });

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <SaleableBatchesClient
        initialBatches={batches}
        statusOptions={SALEABLE_STATUSES as unknown as string[]}
        defaultStatuses={statusFilter && statusFilter.length > 0 ? statusFilter : [...SALEABLE_STATUSES]}
      />
    </PageFrame>
  );
}

