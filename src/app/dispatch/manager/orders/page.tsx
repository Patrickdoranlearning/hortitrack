import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Calendar, User, Truck, Filter } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  picking: "bg-orange-100 text-orange-700",
  picked: "bg-purple-100 text-purple-700",
  qc_passed: "bg-teal-100 text-teal-700",
  loading: "bg-indigo-100 text-indigo-700",
  dispatched: "bg-green-100 text-green-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

/**
 * Orders Page - Displays all orders with status and assignment info
 */
export default async function DispatchOrdersPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/manager/orders");
    }
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Error loading orders.</p>
        </Card>
      </div>
    );
  }

  // Fetch orders with related data
  // Note: delivery_runs are linked via delivery_items table
  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      requested_delivery_date,
      total_trolleys,
      notes,
      created_at,
      customer:customers(id, name),
      delivery_items(
        id,
        delivery_run:delivery_runs(id, load_name, run_date)
      ),
      pick_lists(
        id,
        status,
        assigned_user_id
      )
    `)
    .eq("org_id", orgId)
    .in("status", ["confirmed", "processing", "picking", "picked", "qc_passed", "loading"])
    .order("requested_delivery_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching orders:", error.message || JSON.stringify(error));
  }

  // Fetch picker names separately (profiles table has same ID as auth.users)
  const assignedUserIds = (orders || [])
    .flatMap((o: any) => o.pick_lists || [])
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

  // Count by status
  const statusCounts = (orders || []).reduce((acc: Record<string, number>, order: any) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Orders</h2>
          <p className="text-muted-foreground text-sm">
            View and manage orders for dispatch
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge
            key={status}
            variant="secondary"
            className={`${STATUS_COLORS[status] || "bg-gray-100"} px-3 py-1`}
          >
            {status.replace("_", " ")}: {count}
          </Badge>
        ))}
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {(!orders || orders.length === 0) ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Orders</h3>
              <p className="text-muted-foreground">
                No orders currently need dispatch attention
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Picker</TableHead>
                  <TableHead>Load</TableHead>
                  <TableHead className="text-right">Trolleys</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => {
                  const pickList = order.pick_lists?.[0];
                  const pickerName = pickList?.assigned_user_id ? pickerMap[pickList.assigned_user_id] : null;
                  // Get delivery run from delivery_items (first one if multiple)
                  const deliveryItem = order.delivery_items?.[0];
                  const deliveryRun = deliveryItem?.delivery_run;

                  return (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={`/sales/orders/${order.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {order.customer?.name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {order.requested_delivery_date
                            ? format(new Date(order.requested_delivery_date), "EEE, MMM d")
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[order.status] || "bg-gray-100"}
                        >
                          {order.status?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pickerName || (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deliveryRun ? (
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {deliveryRun.load_name || `Load`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.total_trolleys || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
