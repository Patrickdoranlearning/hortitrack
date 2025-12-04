import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import OrderReadyCard from '@/components/dispatch/OrderReadyCard';
import { getOrdersReadyForDispatch } from '@/server/dispatch/queries.server';

export default async function PackingPage() {
  const ordersReady = await getOrdersReadyForDispatch().catch(() => []);

  // Group orders by packing status
  const notStarted = ordersReady.filter((o) => !o.packingStatus || o.packingStatus === 'not_started');
  const inProgress = ordersReady.filter((o) => o.packingStatus === 'in_progress');
  const completed = ordersReady.filter((o) => o.packingStatus === 'completed' || o.packingStatus === 'verified');

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Order Packing"
          description="Pack and verify orders for dispatch"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Not Started */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-muted-foreground" />
                Not Started
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {notStarted.length}
                </span>
              </CardTitle>
              <CardDescription>Orders awaiting packing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {notStarted.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No orders waiting
                  </div>
                ) : (
                  notStarted.map((order) => (
                    <OrderReadyCard
                      key={order.id}
                      order={order}
                      onClick={() => {
                        // In a real app, this would open a packing dialog/page
                        console.log('Start packing:', order.id);
                      }}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* In Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-blue-500" />
                In Progress
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {inProgress.length}
                </span>
              </CardTitle>
              <CardDescription>Currently being packed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {inProgress.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No orders in progress
                  </div>
                ) : (
                  inProgress.map((order) => (
                    <OrderReadyCard
                      key={order.id}
                      order={order}
                      onClick={() => {
                        console.log('Continue packing:', order.id);
                      }}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-green-500" />
                Completed
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {completed.length}
                </span>
              </CardTitle>
              <CardDescription>Ready to schedule for delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {completed.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No completed orders
                  </div>
                ) : (
                  completed.map((order) => (
                    <OrderReadyCard
                      key={order.id}
                      order={order}
                      onClick={() => {
                        console.log('Schedule delivery:', order.id);
                      }}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageFrame>
  );
}
