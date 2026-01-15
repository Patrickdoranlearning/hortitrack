import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ClipboardList, Plus, Calendar, User } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

/**
 * Picking Management Page - Shows real picking data with stats and queue
 */
export default async function DispatchPickingPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/manager/picking");
    }
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Error loading picking data.</p>
        </Card>
      </div>
    );
  }

  // Get today's date for completed today count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Fetch pick list stats
  const { count: pendingCount } = await supabase
    .from("pick_lists")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "pending");

  const { count: inProgressCount } = await supabase
    .from("pick_lists")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "in_progress");

  const { count: completedTodayCount } = await supabase
    .from("pick_lists")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("completed_at", todayStr);

  // Fetch pending and in-progress pick lists with order info
  const { data: pickLists, error } = await supabase
    .from("pick_lists")
    .select(`
      id,
      status,
      sequence,
      assigned_user_id,
      created_at,
      started_at,
      order:orders(
        id,
        order_number,
        requested_delivery_date,
        customer:customers(name)
      )
    `)
    .eq("org_id", orgId)
    .in("status", ["pending", "in_progress"])
    .order("sequence", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Error fetching pick lists:", error.message || JSON.stringify(error));
  }

  // Fetch picker names for assigned pick lists
  const assignedUserIds = (pickLists || [])
    .map((pl: any) => pl.assigned_user_id)
    .filter(Boolean) as string[];

  let pickerMap: Record<string, string> = {};
  if (assignedUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", [...new Set(assignedUserIds)]);

    if (profiles) {
      pickerMap = profiles.reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.display_name || p.email || "Unknown";
        return acc;
      }, {});
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Picking Management</h2>
          <p className="text-muted-foreground text-sm">
            Manage picking teams, create bulk pick tasks, and track progress
          </p>
        </div>
        <Link href="/dispatch/bulk-picking">
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4" />
            Create Bulk Pick
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Stats Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount || 0}</div>
            <p className="text-xs text-muted-foreground">Orders awaiting picking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressCount || 0}</div>
            <p className="text-xs text-muted-foreground">Currently being picked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedTodayCount || 0}</div>
            <p className="text-xs text-muted-foreground">Orders picked today</p>
          </CardContent>
        </Card>
      </div>

      {/* Picking Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Picking Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!pickLists || pickLists.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders waiting to be picked</p>
              <p className="text-sm mt-2">
                Orders will appear here when confirmed and ready for picking
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {pickLists.map((pl: any) => {
                const order = pl.order;
                const pickerName = pl.assigned_user_id ? pickerMap[pl.assigned_user_id] : null;

                return (
                  <div key={pl.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-mono text-muted-foreground w-8">
                        #{pl.sequence}
                      </div>
                      <div>
                        <div className="font-medium">
                          <Link
                            href={`/sales/orders/${order?.id}`}
                            className="hover:underline text-primary"
                          >
                            {order?.order_number || "Unknown Order"}
                          </Link>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {order?.customer?.name || "Unknown Customer"}
                          </span>
                          {order?.requested_delivery_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(order.requested_delivery_date), "EEE, MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {pickerName ? (
                        <span className="text-sm text-muted-foreground">{pickerName}</span>
                      ) : (
                        <span className="text-sm text-amber-600">Unassigned</span>
                      )}
                      <Badge variant={pl.status === "in_progress" ? "default" : "secondary"}>
                        {pl.status === "in_progress" ? "Picking" : "Pending"}
                      </Badge>
                      <Link href={`/dispatch/picking/${pl.id}/workflow`}>
                        <Button size="sm" variant="outline">
                          {pl.status === "in_progress" ? "Continue" : "Start"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
