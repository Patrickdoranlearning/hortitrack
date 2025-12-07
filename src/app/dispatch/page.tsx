import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import DispatchTable from '@/components/dispatch/DispatchTable';
import { getDispatchBoardData } from '@/server/dispatch/queries.server';

export default async function DispatchPage() {
  // Fetch data server-side
  const { orders, hauliers, growers, routes, deliveryRuns } = await getDispatchBoardData().catch((error) => {
    console.error("Error fetching dispatch board data:", error);
    return { orders: [], hauliers: [], growers: [], routes: [], deliveryRuns: [] };
  });

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Dispatch Dashboard"
          description="Manage orders, assign routes, and dispatch deliveries."
        />
        <DispatchTable
          orders={orders}
          hauliers={hauliers}
          growers={growers}
          routes={routes}
          deliveryRuns={deliveryRuns}
        />
      </div>
    </PageFrame>
  );
}
