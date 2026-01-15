// src/app/api/sales/dashboard/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/server/utils/envelope";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  getISOWeek,
  getYear,
  format,
} from "date-fns";

interface WeeklyDataPoint {
  week: number;
  weekStart: string;
  currentYear: number;
  previousYear: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  varietyName: string;
  sizeName: string;
  quantitySold: number;
  revenue: number;
}

interface DashboardMetrics {
  thisWeekRevenue: number;
  thisWeekRevenueChange: number;
  thisMonthRevenue: number;
  thisMonthRevenueChange: number;
  ytdRevenue: number;
  ytdRevenueChange: number;
  avgOrderValue: number;
  avgOrderValueChange: number;
  ordersThisWeek: number;
  ordersThisWeekChange: number;
  trolleysShippedThisWeek: number;
  trolleysShippedChange: number;
  openPipelineValue: number;
  pendingActions: number;
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "unauthenticated", "You must be signed in.");

    const now = new Date();
    const currentYear = getYear(now);
    const previousYear = currentYear - 1;

    // Date ranges
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(thisWeekStart, 1);
    const lastWeekEnd = subWeeks(thisWeekEnd, 1);

    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthSameDay = subMonths(now, 1);

    const thisYearStart = startOfYear(now);
    const lastYearStart = startOfYear(subYears(now, 1));
    const lastYearSameDay = subYears(now, 1);

    // 12 weeks ago for charts
    const twelveWeeksAgo = subWeeks(thisWeekStart, 11);
    const twelveWeeksAgoLastYear = subYears(twelveWeeksAgo, 1);

    // Parallel fetch all data
    const [
      thisWeekOrders,
      lastWeekOrders,
      thisMonthOrders,
      lastMonthOrders,
      ytdOrders,
      lastYtdOrders,
      openPipeline,
      pendingTasks,
      thisWeekTrolleys,
      lastWeekTrolleys,
      weeklySalesData,
      weeklyTrolleysData,
      topProductsData,
    ] = await Promise.all([
      // This week orders
      supabase
        .from("orders")
        .select("total_inc_vat")
        .gte("created_at", thisWeekStart.toISOString())
        .lte("created_at", thisWeekEnd.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Last week orders
      supabase
        .from("orders")
        .select("total_inc_vat")
        .gte("created_at", lastWeekStart.toISOString())
        .lte("created_at", lastWeekEnd.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // This month orders (MTD)
      supabase
        .from("orders")
        .select("total_inc_vat")
        .gte("created_at", thisMonthStart.toISOString())
        .lte("created_at", now.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Last month same period
      supabase
        .from("orders")
        .select("total_inc_vat")
        .gte("created_at", lastMonthStart.toISOString())
        .lte("created_at", lastMonthSameDay.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // YTD orders
      supabase
        .from("orders")
        .select("total_inc_vat")
        .gte("created_at", thisYearStart.toISOString())
        .lte("created_at", now.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Last year same period
      supabase
        .from("orders")
        .select("total_inc_vat")
        .gte("created_at", lastYearStart.toISOString())
        .lte("created_at", lastYearSameDay.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Open pipeline (confirmed, picking, packed)
      supabase
        .from("orders")
        .select("total_inc_vat")
        .in("status", ["confirmed", "picking", "packed"]),

      // Pending admin tasks
      supabase
        .from("v_sales_admin_inbox")
        .select("id"),

      // Trolleys shipped this week (from pick_lists)
      supabase
        .from("pick_lists")
        .select("trolleys_used")
        .gte("updated_at", thisWeekStart.toISOString())
        .lte("updated_at", thisWeekEnd.toISOString())
        .eq("status", "completed"),

      // Trolleys shipped last week
      supabase
        .from("pick_lists")
        .select("trolleys_used")
        .gte("updated_at", lastWeekStart.toISOString())
        .lte("updated_at", lastWeekEnd.toISOString())
        .eq("status", "completed"),

      // Weekly sales data for chart (last 12 weeks, current and previous year)
      supabase
        .from("orders")
        .select("created_at, total_inc_vat")
        .gte("created_at", twelveWeeksAgoLastYear.toISOString())
        .not("status", "in", '("cancelled","draft")'),

      // Weekly trolleys data for chart
      supabase
        .from("pick_lists")
        .select("updated_at, trolleys_used")
        .gte("updated_at", twelveWeeksAgoLastYear.toISOString())
        .eq("status", "completed"),

      // Top products YTD
      supabase
        .from("order_items")
        .select(`
          quantity,
          unit_price_ex_vat,
          skus(
            id,
            display_name,
            plant_varieties(name),
            plant_sizes(name)
          ),
          orders!inner(created_at, status)
        `)
        .gte("orders.created_at", thisYearStart.toISOString())
        .not("orders.status", "in", '("cancelled","draft")'),
    ]);

    // Calculate metrics
    const thisWeekRev = (thisWeekOrders.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);
    const lastWeekRev = (lastWeekOrders.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);

    const thisMonthRev = (thisMonthOrders.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);
    const lastMonthRev = (lastMonthOrders.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);

    const ytdRev = (ytdOrders.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);
    const lastYtdRev = (lastYtdOrders.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);

    const thisMonthCount = thisMonthOrders.data?.length ?? 0;
    const lastMonthCount = lastMonthOrders.data?.length ?? 0;
    const avgOrderThis = thisMonthCount > 0 ? thisMonthRev / thisMonthCount : 0;
    const avgOrderLast = lastMonthCount > 0 ? lastMonthRev / lastMonthCount : 0;

    const thisWeekCount = thisWeekOrders.data?.length ?? 0;
    const lastWeekCount = lastWeekOrders.data?.length ?? 0;

    const thisWeekTrolleysSum = (thisWeekTrolleys.data ?? []).reduce((sum, p) => sum + (p.trolleys_used || 0), 0);
    const lastWeekTrolleysSum = (lastWeekTrolleys.data ?? []).reduce((sum, p) => sum + (p.trolleys_used || 0), 0);

    const pipelineValue = (openPipeline.data ?? []).reduce((sum, o) => sum + (o.total_inc_vat || 0), 0);

    const metrics: DashboardMetrics = {
      thisWeekRevenue: thisWeekRev,
      thisWeekRevenueChange: calculatePercentageChange(thisWeekRev, lastWeekRev),
      thisMonthRevenue: thisMonthRev,
      thisMonthRevenueChange: calculatePercentageChange(thisMonthRev, lastMonthRev),
      ytdRevenue: ytdRev,
      ytdRevenueChange: calculatePercentageChange(ytdRev, lastYtdRev),
      avgOrderValue: Math.round(avgOrderThis),
      avgOrderValueChange: calculatePercentageChange(avgOrderThis, avgOrderLast),
      ordersThisWeek: thisWeekCount,
      ordersThisWeekChange: thisWeekCount - lastWeekCount,
      trolleysShippedThisWeek: thisWeekTrolleysSum,
      trolleysShippedChange: thisWeekTrolleysSum - lastWeekTrolleysSum,
      openPipelineValue: pipelineValue,
      pendingActions: pendingTasks.data?.length ?? 0,
    };

    // Process weekly sales chart data
    const weeklySalesMap = new Map<string, { currentYear: number; previousYear: number }>();

    // Initialize 12 weeks
    for (let i = 0; i < 12; i++) {
      const weekDate = subWeeks(thisWeekStart, 11 - i);
      const weekNum = getISOWeek(weekDate);
      const key = `${weekNum}`;
      weeklySalesMap.set(key, { currentYear: 0, previousYear: 0 });
    }

    // Aggregate sales by week
    (weeklySalesData.data ?? []).forEach((order: any) => {
      const orderDate = new Date(order.created_at);
      const orderYear = getYear(orderDate);
      const orderWeek = getISOWeek(orderDate);
      const key = `${orderWeek}`;

      if (weeklySalesMap.has(key)) {
        const entry = weeklySalesMap.get(key)!;
        if (orderYear === currentYear) {
          entry.currentYear += order.total_inc_vat || 0;
        } else if (orderYear === previousYear) {
          entry.previousYear += order.total_inc_vat || 0;
        }
      }
    });

    const weeklySales: WeeklyDataPoint[] = [];
    for (let i = 0; i < 12; i++) {
      const weekDate = subWeeks(thisWeekStart, 11 - i);
      const weekNum = getISOWeek(weekDate);
      const key = `${weekNum}`;
      const data = weeklySalesMap.get(key) ?? { currentYear: 0, previousYear: 0 };
      weeklySales.push({
        week: weekNum,
        weekStart: format(weekDate, "MMM d"),
        currentYear: Math.round(data.currentYear),
        previousYear: Math.round(data.previousYear),
      });
    }

    // Process weekly trolleys chart data
    const weeklyTrolleysMap = new Map<string, { currentYear: number; previousYear: number }>();

    for (let i = 0; i < 12; i++) {
      const weekDate = subWeeks(thisWeekStart, 11 - i);
      const weekNum = getISOWeek(weekDate);
      const key = `${weekNum}`;
      weeklyTrolleysMap.set(key, { currentYear: 0, previousYear: 0 });
    }

    (weeklyTrolleysData.data ?? []).forEach((pick: any) => {
      const pickDate = new Date(pick.updated_at);
      const pickYear = getYear(pickDate);
      const pickWeek = getISOWeek(pickDate);
      const key = `${pickWeek}`;

      if (weeklyTrolleysMap.has(key)) {
        const entry = weeklyTrolleysMap.get(key)!;
        if (pickYear === currentYear) {
          entry.currentYear += pick.trolleys_used || 0;
        } else if (pickYear === previousYear) {
          entry.previousYear += pick.trolleys_used || 0;
        }
      }
    });

    const weeklyTrolleys: WeeklyDataPoint[] = [];
    for (let i = 0; i < 12; i++) {
      const weekDate = subWeeks(thisWeekStart, 11 - i);
      const weekNum = getISOWeek(weekDate);
      const key = `${weekNum}`;
      const data = weeklyTrolleysMap.get(key) ?? { currentYear: 0, previousYear: 0 };
      weeklyTrolleys.push({
        week: weekNum,
        weekStart: format(weekDate, "MMM d"),
        currentYear: data.currentYear,
        previousYear: data.previousYear,
      });
    }

    // Process top products
    const productMap = new Map<string, {
      productId: string;
      varietyName: string;
      sizeName: string;
      quantitySold: number;
      revenue: number
    }>();

    (topProductsData.data ?? []).forEach((item: any) => {
      const sku = item.skus;
      if (!sku) return;

      const varietyName = sku.plant_varieties?.name ?? "";
      const sizeName = sku.plant_sizes?.name ?? "";
      const displayName = sku.display_name || `${varietyName} ${sizeName}`.trim() || "Unknown Product";
      const productId = sku.id;

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          varietyName: displayName,
          sizeName,
          quantitySold: 0,
          revenue: 0,
        });
      }

      const entry = productMap.get(productId)!;
      entry.quantitySold += item.quantity || 0;
      entry.revenue += (item.quantity || 0) * (item.unit_price_ex_vat || 0);
    });

    const topProducts: TopProduct[] = Array.from(productMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10)
      .map(p => ({
        productId: p.productId,
        productName: p.varietyName,
        varietyName: p.varietyName,
        sizeName: p.sizeName,
        quantitySold: p.quantitySold,
        revenue: Math.round(p.revenue),
      }));

    return NextResponse.json({
      ok: true,
      metrics,
      weeklySales,
      weeklyTrolleys,
      topProducts,
    });
  } catch (err) {
    console.error("[api:sales/dashboard][GET]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
