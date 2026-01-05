import { PageFrame } from '@/ui/templates';
import ProductionJobsClient from "./ProductionJobsClient";
import { getProductionJobs, getAvailableGhostBatches } from "@/server/production/jobs";
import { getAssignableStaff } from "@/server/tasks/service";

export const dynamic = "force-dynamic";

export default async function ProductionJobsPage() {
  const [jobs, staff, availableBatches] = await Promise.all([
    getProductionJobs(),
    getAssignableStaff(),
    getAvailableGhostBatches(),
  ]);

  return (
    <PageFrame moduleKey="production">
      <ProductionJobsClient
        initialJobs={jobs}
        staff={staff}
        availableBatches={availableBatches}
      />
    </PageFrame>
  );
}



