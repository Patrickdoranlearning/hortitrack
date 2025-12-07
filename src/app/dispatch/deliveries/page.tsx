import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getDispatchBoardData } from '@/server/dispatch/queries.server';
import DispatchTable from '@/components/dispatch/DispatchTable';

export default async function DeliveriesPage() {
  const { orders, hauliers, growers, routes, deliveryRuns } = await getDispatchBoardData().catch((error) => {
    console.error("Error fetching dispatch board data for page:", error);
    return { orders: [], hauliers: [], growers: [], routes: [], deliveryRuns: [] };
  });

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Delivery Routes"
          description="Manage delivery runs and track progress"
          actionsSlot={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Delivery Run
            </Button>
          }
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
