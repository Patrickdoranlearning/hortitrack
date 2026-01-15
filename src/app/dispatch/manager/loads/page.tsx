import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Calendar, Plus, ChevronRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Dispatch Loads Page - Shows all delivery runs (loads) for management
 */
export default async function DispatchLoadsPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/manager/loads");
    }
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Error loading loads data.</p>
        </Card>
      </div>
    );
  }

  // Get date ranges
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Fetch delivery runs with related data
  const { data: deliveryRuns, error } = await supabase
    .from("delivery_runs")
    .select(`
      id,
      load_name,
      run_date,
      run_number,
      status,
      notes,
      created_at,
      haulier:hauliers(id, name),
      vehicle:haulier_vehicles(id, name, trolley_capacity),
      delivery_items(
        id,
        order_id,
        orders(
          id,
          order_number,
          trolleys_estimated,
          status
        )
      )
    `)
    .eq("org_id", orgId)
    .in("status", ["planned", "loading", "in_transit"])
    .order("run_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching delivery runs:", error.message || JSON.stringify(error));
  }

  // Calculate stats
  const plannedCount = (deliveryRuns || []).filter((r: any) => r.status === "planned").length;
  const loadingCount = (deliveryRuns || []).filter((r: any) => r.status === "loading").length;
  const inTransitCount = (deliveryRuns || []).filter((r: any) => r.status === "in_transit").length;

  // Group loads by date
  const loadsByDate: Record<string, any[]> = {};
  (deliveryRuns || []).forEach((run: any) => {
    const dateKey = run.run_date || 'unscheduled';
    if (!loadsByDate[dateKey]) {
      loadsByDate[dateKey] = [];
    }
    loadsByDate[dateKey].push(run);
  });

  const sortedDates = Object.keys(loadsByDate).sort((a, b) => {
    if (a === 'unscheduled') return 1;
    if (b === 'unscheduled') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Loads Management</h2>
          <p className="text-muted-foreground text-sm">
            View and manage delivery runs and vehicle assignments
          </p>
        </div>
        <Link href="/dispatch/manager/orders">
          <Button variant="outline" className="gap-2">
            <Package className="h-4 w-4" />
            Assign Orders
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Planned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plannedCount}</div>
            <p className="text-xs text-muted-foreground">Loads awaiting orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">
              Loading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{loadingCount}</div>
            <p className="text-xs text-muted-foreground">Ready to dispatch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              In Transit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inTransitCount}</div>
            <p className="text-xs text-muted-foreground">On the road</p>
          </CardContent>
        </Card>
      </div>

      {/* Loads by Date */}
      {sortedDates.length === 0 ? (
        <Card className="p-8 text-center">
          <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No active loads</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create a new load to start assigning orders for delivery
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const loads = loadsByDate[dateKey];
            const isToday = dateKey === todayStr;
            const dateLabel = dateKey === 'unscheduled'
              ? 'Unscheduled'
              : format(new Date(dateKey + 'T00:00:00'), 'EEEE, MMMM d');

            return (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    {dateLabel}
                    {isToday && (
                      <Badge variant="default" className="ml-2 text-xs">Today</Badge>
                    )}
                  </h3>
                  <Badge variant="outline" className="ml-auto">
                    {loads.length} load{loads.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="grid gap-3">
                  {loads.map((load: any) => {
                    const orderCount = load.delivery_items?.length || 0;
                    const totalTrolleys = load.delivery_items?.reduce(
                      (sum: number, item: any) => sum + (item.orders?.trolleys_estimated || 0),
                      0
                    ) || 0;
                    const vehicleCapacity = load.vehicle?.trolley_capacity || 0;
                    const fillPercent = vehicleCapacity > 0
                      ? Math.round((totalTrolleys / vehicleCapacity) * 100)
                      : 0;

                    return (
                      <Link
                        key={load.id}
                        href={`/dispatch/manager/loads/${load.id}`}
                        className="block"
                      >
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-muted rounded-lg">
                                  <Truck className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-semibold">
                                    {load.load_name || load.run_number || `Load #${load.id.slice(0, 6)}`}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {load.haulier?.name || 'No haulier'}
                                    {load.vehicle?.name && ` • ${load.vehicle.name}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    {orderCount} order{orderCount !== 1 ? 's' : ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {totalTrolleys}/{vehicleCapacity || '?'} trolleys
                                    {vehicleCapacity > 0 && (
                                      <span className={
                                        fillPercent > 100 ? ' text-red-600' :
                                        fillPercent > 80 ? ' text-yellow-600' :
                                        ' text-green-600'
                                      }>
                                        {' '}({fillPercent}%)
                                      </span>
                                    )}
                                  </p>
                                </div>

                                <Badge
                                  variant={
                                    load.status === 'in_transit' ? 'default' :
                                    load.status === 'loading' ? 'secondary' :
                                    'outline'
                                  }
                                  className={
                                    load.status === 'in_transit' ? 'bg-green-600' :
                                    load.status === 'loading' ? 'bg-yellow-500' :
                                    ''
                                  }
                                >
                                  {load.status === 'in_transit' ? 'In Transit' :
                                   load.status === 'loading' ? 'Loading' :
                                   'Planned'}
                                </Badge>

                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
