import { PageFrame } from "@/ui/templates/PageFrame";
import ProductionTasksClient from "./ProductionTasksClient";
import { getProductionJobs, getAvailableGhostBatches } from "@/server/production/jobs";
import { getAssignableStaff } from "@/server/tasks/service";

export const dynamic = "force-dynamic";

export default async function ProductionTasksPage() {
  const [jobs, staff, availableBatches] = await Promise.all([
    getProductionJobs(),
    getAssignableStaff(),
    getAvailableGhostBatches(),
  ]);

  return (
    <PageFrame moduleKey="tasks">
      <ProductionTasksClient
        initialJobs={jobs}
        staff={staff}
        availableBatches={availableBatches}
      />
    </PageFrame>
  );
}

