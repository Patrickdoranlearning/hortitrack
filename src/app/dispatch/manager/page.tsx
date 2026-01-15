import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { Button } from "@/components/ui/button";
import {
  Package,
  Truck,
  ClipboardCheck,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

export default async function DispatchManagerPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/manager");
    }
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Error loading dispatch data.</p>
        </Card>
      </div>
    );
  }

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString();

  // Fetch orders needing dispatch (confirmed, not yet picked/loaded)
  const { data: pendingOrders, count: pendingCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["confirmed"]);

  // Fetch orders being picked today
  const { data: pickingOrders, count: pickingCount } = await supabase
    .from("pick_lists")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["pending", "in_progress"]);

  // Fetch orders awaiting QC
  const { data: qcOrders, count: qcCount } = await supabase
    .from("pick_lists")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["completed", "qc_pending"]);

  // Fetch today's delivery runs
  const { data: todayRuns } = await supabase
    .from("delivery_runs")
    .select(`
      id,
      run_date,
      load_name,
      status,
      haulier:hauliers(name)
    `)
    .eq("org_id", orgId)
    .gte("run_date", todayStr)
    .lt("run_date", tomorrowStr)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recent activity (pick list events)
  const { data: recentActivity } = await supabase
    .from("pick_list_events")
    .select(`
      id,
      event_type,
      description,
      created_at,
      pick_list:pick_lists(
        order:orders(order_number, customer:customers(name))
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Count dispatched today
  const { count: dispatchedCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "dispatched")
    .gte("updated_at", todayStr);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold">Dispatch Overview</h2>
        <p className="text-muted-foreground text-sm">
          Daily dispatch metrics and quick actions
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pending Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount || 0}</div>
            <p className="text-xs text-muted-foreground">Need assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Being Picked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pickingCount || 0}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Awaiting QC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{qcCount || 0}</div>
            <p className="text-xs text-muted-foreground">Need review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Dispatched Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dispatchedCount || 0}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dispatch/manager/orders">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Manage Orders</h3>
                  <p className="text-sm text-muted-foreground">
                    View orders, assign pickers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dispatch/manager/qc">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <ClipboardCheck className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold">QC Review</h3>
                  <p className="text-sm text-muted-foreground">
                    Review picked orders
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Loads & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Loads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Today&apos;s Loads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!todayRuns || todayRuns.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No loads scheduled for today
              </p>
            ) : (
              <div className="space-y-3">
                {todayRuns.map((run: any) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {run.load_name || (run.run_date ? format(new Date(run.run_date), "EEE MMM d") : "Unnamed Load")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.haulier?.name || "No haulier"}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        run.status === "dispatched"
                          ? "bg-green-100 text-green-700"
                          : run.status === "loading"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {run.status || "pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!recentActivity || recentActivity.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((event: any) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div
                      className={`mt-1 p-1 rounded-full ${
                        event.event_type?.includes("complete")
                          ? "bg-green-100"
                          : event.event_type?.includes("start")
                          ? "bg-blue-100"
                          : "bg-gray-100"
                      }`}
                    >
                      {event.event_type?.includes("complete") ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : event.event_type?.includes("start") ? (
                        <TrendingUp className="h-3 w-3 text-blue-600" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {event.pick_list?.order?.customer?.name || "Unknown"} -{" "}
                        {event.pick_list?.order?.order_number || ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.description?.slice(0, 50) || event.event_type}
                        {" · "}
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
