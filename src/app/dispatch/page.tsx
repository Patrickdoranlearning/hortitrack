import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import DispatchClient from './DispatchClient';
import { getActiveDeliveryRuns, getOrdersReadyForDispatch, getCustomerTrolleyBalances } from '@/server/dispatch/queries.server';

export default async function DispatchPage() {
  // Fetch data server-side
  const [activeRuns, ordersReady, trolleyBalances] = await Promise.all([
    getActiveDeliveryRuns().catch(() => []),
    getOrdersReadyForDispatch().catch(() => []),
    getCustomerTrolleyBalances().catch(() => []),
  ]);

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Dispatch Dashboard"
          description="Manage order packing, delivery schedules, and logistics."
        />
        <DispatchClient
          activeRuns={activeRuns}
          ordersReady={ordersReady}
          trolleyBalances={trolleyBalances}
        />
      </div>
    </PageFrame>
  );
}
