import { PageFrame } from '@/ui/templates';
import ExecutionClient from "./ExecutionClient";
import { getExecutionGroups } from "@/server/production/execution-groups";
import { getPlanningSnapshot } from "@/server/planning/service";

export const dynamic = "force-dynamic";

export default async function ExecutionPage() {
  const [groups, snapshot] = await Promise.all([
    getExecutionGroups(),
    getPlanningSnapshot(),
  ]);

  // Filter to just the planning batches (ghost batches) for execution
  const planningBatches = snapshot.batches.filter((b) => b.isGhost);

  return (
    <PageFrame moduleKey="production">
      <ExecutionClient
        initialGroups={groups}
        initialBatches={planningBatches}
      />
    </PageFrame>
  );
}
