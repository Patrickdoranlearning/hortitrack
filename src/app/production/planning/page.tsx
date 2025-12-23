
import { PageFrame } from '@/ui/templates';
import PlanningClient from "./PlanningClient";
import { getPlanningSnapshot, listProtocols } from "@/server/planning/service";
import { ReferenceDataProvider } from "@/contexts/ReferenceDataContext";

export const dynamic = "force-dynamic";

export default async function ProductionPlanningPage() {
  const [snapshot, protocols] = await Promise.all([getPlanningSnapshot(), listProtocols()]);

  return (
    <PageFrame moduleKey="production">
      <ReferenceDataProvider>
        <PlanningClient initialSnapshot={snapshot} initialProtocols={protocols} />
      </ReferenceDataProvider>
    </PageFrame>
  );
}
