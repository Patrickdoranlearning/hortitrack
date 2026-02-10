import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";
import { logger } from "@/server/utils/logger";

export interface DashboardStats {
  // Production metrics
  production: {
    totalInStock: number;
    activeBatches: number;
    readyForSale: number;
    lossLast7Days: number;
  };
  // Sales metrics
  sales: {
    pendingOrders: number;
    dispatchToday: number;
    weeklyRevenue: number;
    weeklyRevenueChange: number;
    topCustomer: {
      name: string;
      orders: number;
    } | null;
  };
  // Today's activity
  today: {
    deliveries: number;
    pickLists: number;
    tasksCompleted: number;
    tasksPending: number;
  };
}

export async function GET() {
  try {
    const { supabase, orgId } = await getUserAndOrg();
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // Seven days ago for loss calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Last week dates for comparison
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    // Parallel fetch all data
    const [
      // Production data
      batchStats,
      lossEvents,
      // Sales data
      pendingOrdersData,
      todayDeliveriesData,
      weeklyOrdersData,
      lastWeekOrdersData,
      topCustomerData,
      // Today's activity
      todayPickListsData,
      tasksData,
    ] = await Promise.all([
      // Batch stats - aggregate by status
      supabase
        .from("batches")
        .select("status, quantity")
        .eq("org_id", orgId)
        .not("status", "in", '("Archived","Sold")'),

      // Loss events last 7 days
      supabase
        .from("batch_events")
        .select("payload")
        .eq("org_id", orgId)
        .in("type", ["LOSS", "DUMP"])
        .gte("at", sevenDaysAgo.toISOString()),

      // Pending orders (confirmed, picking, packed)
      supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("org_id", orgId)
        .in("status", ["confirmed", "picking", "packed"]),

      // Deliveries scheduled for today
      supabase
        .from("dispatch_runs")
        .select("id", { count: "exact" })
        .eq("org_id", orgId)
        .gte("scheduled_date", format(todayStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(todayEnd, "yyyy-MM-dd")),

      // This week's orders
      supabase
        .from("orders")
        .select("total_inc_vat")
        .eq("org_id", orgId)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Last week's orders for comparison
      supabase
        .from("orders")
        .select("total_inc_vat")
        .eq("org_id", orgId)
        .gte("created_at", lastWeekStart.toISOString())
        .lte("created_at", lastWeekEnd.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Top customer this week
      supabase
        .from("orders")
        .select("customer_id, customers(name)")
        .eq("org_id", orgId)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Pick lists for today
      supabase
        .from("pick_lists")
        .select("id", { count: "exact" })
        .eq("org_id", orgId)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString()),

      // Tasks status
      supabase
        .from("tasks")
        .select("status")
        .eq("org_id", orgId)
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString()),
    ]);

    // Calculate production metrics
    let totalInStock = 0;
    let activeBatches = 0;
    let readyForSale = 0;

    (batchStats.data ?? []).forEach((batch) => {
      const qty = batch.quantity ?? 0;
      totalInStock += qty;
      activeBatches++;
      if (batch.status === "Ready" || batch.status === "Ready for Sale") {
        readyForSale++;
      }
    });

    // Calculate losses
    let lossLast7Days = 0;
    (lossEvents.data ?? []).forEach((event) => {
      const payload = event.payload as Record<string, unknown>;
      const qty =
        typeof payload?.qty === "number" ? payload.qty :
        typeof payload?.quantity === "number" ? payload.quantity :
        typeof payload?.units === "number" ? payload.units : 0;
      if (qty > 0) lossLast7Days += qty;
    });

    // Calculate sales metrics
    const thisWeekRevenue = (weeklyOrdersData.data ?? []).reduce(
      (sum, o) => sum + (o.total_inc_vat || 0),
      0
    );
    const lastWeekRevenue = (lastWeekOrdersData.data ?? []).reduce(
      (sum, o) => sum + (o.total_inc_vat || 0),
      0
    );
    const revenueChange =
      lastWeekRevenue === 0
        ? thisWeekRevenue > 0
          ? 100
          : 0
        : Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100);

    // Calculate top customer
    const customerCounts = new Map<string, { name: string; count: number }>();
    (topCustomerData.data ?? []).forEach((order) => {
      const customerId = order.customer_id;
      const customerName = (order.customers as { name?: string } | null)?.name ?? "Unknown";
      if (customerId) {
        const existing = customerCounts.get(customerId);
        if (existing) {
          existing.count++;
        } else {
          customerCounts.set(customerId, { name: customerName, count: 1 });
        }
      }
    });

    let topCustomer: { name: string; orders: number } | null = null;
    let maxOrders = 0;
    customerCounts.forEach(({ name, count }) => {
      if (count > maxOrders) {
        maxOrders = count;
        topCustomer = { name, orders: count };
      }
    });

    // Calculate today's tasks
    const tasksCompleted = (tasksData.data ?? []).filter(
      (t) => t.status === "completed"
    ).length;
    const tasksPending = (tasksData.data ?? []).filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    ).length;

    const stats: DashboardStats = {
      production: {
        totalInStock,
        activeBatches,
        readyForSale,
        lossLast7Days,
      },
      sales: {
        pendingOrders: pendingOrdersData.count ?? 0,
        dispatchToday: todayDeliveriesData.count ?? 0,
        weeklyRevenue: Math.round(thisWeekRevenue),
        weeklyRevenueChange: revenueChange,
        topCustomer,
      },
      today: {
        deliveries: todayDeliveriesData.count ?? 0,
        pickLists: todayPickListsData.count ?? 0,
        tasksCompleted,
        tasksPending,
      },
    };

    return NextResponse.json(stats);
  } catch (err) {
    logger.api.error("Dashboard stats fetch failed", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

