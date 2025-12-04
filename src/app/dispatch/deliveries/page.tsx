import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import DeliveryRunCard from '@/components/dispatch/DeliveryRunCard';
import { getActiveDeliveryRuns } from '@/server/dispatch/queries.server';

export default async function DeliveriesPage() {
  const activeRuns = await getActiveDeliveryRuns().catch(() => []);

  // Group runs by status
  const planned = activeRuns.filter((r) => r.status === 'planned');
  const loading = activeRuns.filter((r) => r.status === 'loading');
  const inTransit = activeRuns.filter((r) => r.status === 'in_transit');
  const completed = activeRuns.filter((r) => r.status === 'completed');

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

        <div className="space-y-6">
          {/* Planned Runs */}
          {planned.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Planned Runs
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({planned.length})
                  </span>
                </CardTitle>
                <CardDescription>Routes scheduled but not yet started</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {planned.map((run) => (
                    <DeliveryRunCard
                      key={run.id}
                      run={run}
                      onClick={() => {
                        window.location.href = `/dispatch/deliveries/${run.id}`;
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading Runs */}
          {loading.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Loading
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({loading.length})
                  </span>
                </CardTitle>
                <CardDescription>Currently loading vehicles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {loading.map((run) => (
                    <DeliveryRunCard
                      key={run.id}
                      run={run}
                      onClick={() => {
                        window.location.href = `/dispatch/deliveries/${run.id}`;
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* In Transit */}
          {inTransit.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  In Transit
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({inTransit.length})
                  </span>
                </CardTitle>
                <CardDescription>Deliveries in progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inTransit.map((run) => (
                    <DeliveryRunCard
                      key={run.id}
                      run={run}
                      onClick={() => {
                        window.location.href = `/dispatch/deliveries/${run.id}`;
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Today */}
          {completed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Completed
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({completed.length})
                  </span>
                </CardTitle>
                <CardDescription>Finished deliveries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completed.map((run) => (
                    <DeliveryRunCard
                      key={run.id}
                      run={run}
                      onClick={() => {
                        window.location.href = `/dispatch/deliveries/${run.id}`;
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {activeRuns.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  No delivery runs found. Create a new run to get started.
                </p>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Delivery Run
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
