
import { PageFrame } from "@/ui/templates/PageFrame";
import PlanningClient from "./PlanningClient";
import { getPlanningSnapshot, listProtocols } from "@/server/planning/service";

export const dynamic = "force-dynamic";

export default async function ProductionPlanningPage() {
  const [snapshot, protocols] = await Promise.all([getPlanningSnapshot(), listProtocols()]);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="production">
      <PlanningClient initialSnapshot={snapshot} initialProtocols={protocols} />
    </PageFrame>
  );
}
