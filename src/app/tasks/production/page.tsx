import { PageFrame } from '@/ui/templates';
import ProductionTasksClient from "./ProductionTasksClient";
import { getProductionJobs, getAvailableGhostBatches } from "@/server/production/jobs";
import { getAssignableStaff } from "@/server/tasks/service";
import * as Sentry from '@sentry/nextjs';

export const dynamic = "force-dynamic";

export default async function ProductionTasksPage() {
  try {
    const [jobs, staff, availableBatches] = await Promise.all([
      getProductionJobs().catch((err) => {
        console.error('[Production Tasks Page] Failed to fetch jobs:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getProductionJobs' } });
        throw err;
      }),
      getAssignableStaff().catch((err) => {
        console.error('[Production Tasks Page] Failed to fetch staff:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getAssignableStaff' } });
        throw err;
      }),
      getAvailableGhostBatches().catch((err) => {
        console.error('[Production Tasks Page] Failed to fetch batches:', err);
        Sentry.captureException(err, { tags: { module: 'tasks', operation: 'getAvailableGhostBatches' } });
        throw err;
      }),
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
  } catch (error) {
    console.error('[Production Tasks Page] Page render failed:', error);
    throw error; // Re-throw to trigger error boundary
  }
}





