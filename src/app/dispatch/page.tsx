import { redirect } from "next/navigation";
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import DispatchTable from '@/components/dispatch/DispatchTable';
import { getDispatchBoardData } from '@/server/dispatch/queries.server';

export default async function DispatchPage() {
  let data;

  try {
    // Fetch data server-side
    data = await getDispatchBoardData();
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      redirect("/login?next=/dispatch");
    }
    console.error("Error fetching dispatch board data:", error);
    data = { orders: [], hauliers: [], growers: [], routes: [], deliveryRuns: [] };
  }

  const { orders, hauliers, growers, routes, deliveryRuns } = data;

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
