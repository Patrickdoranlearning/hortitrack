import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PickingQueueTable, PickingQueueItem } from "@/components/dispatch/manager/PickingQueueTable";

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthorized" || message === "Unauthenticated") {
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

  // Fetch stats and pick lists in parallel
  const [
    { count: pendingCount },
    { count: inProgressCount },
    { count: completedTodayCount },
    { data: pickLists, error: pickListsError },
  ] = await Promise.all([
    supabase
      .from("pick_lists")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending"),
    supabase
      .from("pick_lists")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "in_progress"),
    supabase
      .from("pick_lists")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "completed")
      .gte("completed_at", todayStr),
    supabase
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
      .limit(50),
  ]);

  if (pickListsError) {
    console.error("Error fetching pick lists:", pickListsError.message || JSON.stringify(pickListsError));
  }

  // Batch fetch item counts + progress per pick list
  const pickListIds = (pickLists || []).map((pl: Record<string, unknown>) => pl.id as string);
  let itemStatsMap: Record<string, { totalItems: number; totalQty: number; pickedQty: number }> = {};

  if (pickListIds.length > 0) {
    const { data: pickItems } = await supabase
      .from("pick_items")
      .select("pick_list_id, target_qty, picked_qty")
      .in("pick_list_id", pickListIds);

    if (pickItems) {
      for (const item of pickItems as Array<{ pick_list_id: string; target_qty: number; picked_qty: number }>) {
        if (!itemStatsMap[item.pick_list_id]) {
          itemStatsMap[item.pick_list_id] = { totalItems: 0, totalQty: 0, pickedQty: 0 };
        }
        itemStatsMap[item.pick_list_id].totalItems += 1;
        itemStatsMap[item.pick_list_id].totalQty += item.target_qty || 0;
        itemStatsMap[item.pick_list_id].pickedQty += item.picked_qty || 0;
      }
    }
  }

  // Batch fetch picker names
  const assignedUserIds = (pickLists || [])
    .map((pl: Record<string, unknown>) => pl.assigned_user_id as string | null)
    .filter(Boolean) as string[];

  let pickerMap: Record<string, string> = {};
  if (assignedUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", [...new Set(assignedUserIds)]);

    if (profiles) {
      pickerMap = (profiles as Array<{ id: string; display_name: string | null; email: string | null }>).reduce(
        (acc: Record<string, string>, p) => {
          acc[p.id] = p.display_name || p.email || "Unknown";
          return acc;
        },
        {}
      );
    }
  }

  // Transform data for the client component
  const queueItems: PickingQueueItem[] = (pickLists || []).map((pl: Record<string, unknown>) => {
    const order = pl.order as { id: string; order_number: string; requested_delivery_date: string | null; customer: { name: string } | null } | null;
    const stats = itemStatsMap[pl.id as string] || { totalItems: 0, totalQty: 0, pickedQty: 0 };

    return {
      id: pl.id as string,
      sequence: pl.sequence as number,
      status: pl.status as 'pending' | 'in_progress',
      assignedTo: pl.assigned_user_id ? pickerMap[pl.assigned_user_id as string] || null : null,
      startedAt: pl.started_at as string | null,
      createdAt: pl.created_at as string,
      orderNumber: order?.order_number || "Unknown Order",
      orderId: order?.id || "",
      customerName: order?.customer?.name || "Unknown Customer",
      deliveryDate: order?.requested_delivery_date || null,
      totalItems: stats.totalItems,
      totalQty: stats.totalQty,
      pickedQty: stats.pickedQty,
    };
  });

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

      <PickingQueueTable items={queueItems} />
    </div>
  );
}
