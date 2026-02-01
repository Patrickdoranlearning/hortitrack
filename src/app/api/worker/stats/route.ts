import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";
import type {
  StatsSummary,
  StatsComparison,
  TaskBreakdown,
  StatsResponse,
} from "@/types/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RangeSchema = z.enum(["today", "week", "month"]);

const QuerySchema = z.object({
  range: RangeSchema.optional().default("today"),
});

/**
 * GET /api/worker/stats
 * Returns worker productivity stats for the given range
 */
export async function GET(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Parse query params
    const url = new URL(req.url);
    const rangeParam = url.searchParams.get("range") ?? "today";
    const query = QuerySchema.parse({ range: rangeParam });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Calculate date ranges based on the period
    let currentStart: string;
    let currentEnd: string;
    let previousStart: string;
    let previousEnd: string;

    if (query.range === "today") {
      currentStart = todayStr;
      currentEnd = todayStr;
      // Previous period is yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      previousStart = yesterday.toISOString().split("T")[0];
      previousEnd = previousStart;
    } else if (query.range === "week") {
      // Current week (Monday - Sunday)
      const currentWeekStart = new Date(now);
      const dayOfWeek = currentWeekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      currentWeekStart.setDate(currentWeekStart.getDate() + diff);
      currentStart = currentWeekStart.toISOString().split("T")[0];

      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
      currentEnd = currentWeekEnd.toISOString().split("T")[0];

      // Previous week
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      previousStart = prevWeekStart.toISOString().split("T")[0];

      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);
      previousEnd = prevWeekEnd.toISOString().split("T")[0];
    } else {
      // month
      // Current month (1st to today)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStart = monthStart.toISOString().split("T")[0];
      currentEnd = todayStr;

      // Previous month (same day range)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousStart = prevMonthStart.toISOString().split("T")[0];

      // End at the same relative day in the previous month
      const dayOfMonth = now.getDate();
      const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const prevEndDay = Math.min(dayOfMonth, lastDayOfPrevMonth);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, prevEndDay);
      previousEnd = prevMonthEnd.toISOString().split("T")[0];
    }

    // Fetch current period stats
    const [currentStats, previousStats, breakdown, history] = await Promise.all([
      fetchPeriodStats(supabase, orgId, user.id, currentStart, currentEnd),
      fetchPeriodStats(supabase, orgId, user.id, previousStart, previousEnd),
      fetchTaskBreakdown(supabase, orgId, user.id, currentStart, currentEnd),
      fetchHistory(supabase, orgId, user.id, query.range, now),
    ]);

    // Calculate comparison
    let comparison: StatsComparison | null = null;
    if (previousStats.tasksCompleted > 0 || currentStats.tasksCompleted > 0) {
      let changePercent: number | null = null;
      if (previousStats.plantsProcessed > 0 && currentStats.plantsProcessed > 0) {
        changePercent = Math.round(
          ((currentStats.plantsProcessed - previousStats.plantsProcessed) /
            previousStats.plantsProcessed) *
            100
        );
      }

      comparison = {
        previousTasksCompleted: previousStats.tasksCompleted,
        previousPlantsProcessed: previousStats.plantsProcessed,
        previousAvgPlantsPerHour: previousStats.avgPlantsPerHour,
        changePercent,
      };
    }

    const response: StatsResponse = {
      summary: currentStats,
      comparison,
      breakdown,
      history,
    };

    return NextResponse.json(response);
  } catch (error) {
    logError("[api/worker/stats] Error", { error });
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    const status = /unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Fetch stats for a given period
 */
async function fetchPeriodStats(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  userId: string,
  startDate: string,
  endDate: string
): Promise<StatsSummary> {
  // Fetch completed tasks with productivity data
  const { data: tasks, error } = await supabase
    .from("tasks_with_productivity")
    .select("id, status, plant_quantity, duration_minutes, plants_per_hour")
    .eq("org_id", orgId)
    .eq("assigned_to", userId)
    .eq("status", "completed")
    .gte("completed_at", `${startDate}T00:00:00`)
    .lte("completed_at", `${endDate}T23:59:59.999`);

  if (error) {
    logError("[api/worker/stats] Error fetching period stats", { error });
    throw new Error(error.message);
  }

  const completedTasks = tasks ?? [];

  // Calculate totals
  const tasksCompleted = completedTasks.length;
  let plantsProcessed = 0;
  let totalMinutesWorked = 0;
  let totalPlantsWithTime = 0;
  let totalMinutesWithPlants = 0;

  for (const task of completedTasks) {
    const plants = task.plant_quantity ?? 0;
    const minutes = task.duration_minutes ?? 0;

    plantsProcessed += plants;
    totalMinutesWorked += minutes;

    if (plants > 0 && minutes > 0) {
      totalPlantsWithTime += plants;
      totalMinutesWithPlants += minutes;
    }
  }

  // Calculate average plants per hour
  let avgPlantsPerHour: number | null = null;
  if (totalMinutesWithPlants > 0 && totalPlantsWithTime > 0) {
    avgPlantsPerHour = Math.round((totalPlantsWithTime / totalMinutesWithPlants) * 60);
  }

  return {
    tasksCompleted,
    plantsProcessed,
    avgPlantsPerHour,
    totalMinutesWorked,
  };
}

/**
 * Fetch task breakdown by module
 */
async function fetchTaskBreakdown(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  userId: string,
  startDate: string,
  endDate: string
): Promise<TaskBreakdown> {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("source_module")
    .eq("org_id", orgId)
    .eq("assigned_to", userId)
    .eq("status", "completed")
    .gte("completed_at", `${startDate}T00:00:00`)
    .lte("completed_at", `${endDate}T23:59:59.999`);

  if (error) {
    logError("[api/worker/stats] Error fetching task breakdown", { error });
    return { production: 0, dispatch: 0, plantHealth: 0 };
  }

  const breakdown: TaskBreakdown = {
    production: 0,
    dispatch: 0,
    plantHealth: 0,
  };

  for (const task of tasks ?? []) {
    switch (task.source_module) {
      case "production":
        breakdown.production++;
        break;
      case "dispatch":
        breakdown.dispatch++;
        break;
      case "plant_health":
        breakdown.plantHealth++;
        break;
    }
  }

  return breakdown;
}

/**
 * Fetch daily history for charts
 */
async function fetchHistory(
  supabase: ReturnType<typeof import("@/server/db/supabase").getSupabaseAdmin>,
  orgId: string,
  userId: string,
  range: "today" | "week" | "month",
  now: Date
): Promise<HistoryEntry[]> {
  // Determine how many days of history to fetch
  let daysBack: number;
  if (range === "today") {
    daysBack = 7; // Show last 7 days for context
  } else if (range === "week") {
    daysBack = 7;
  } else {
    daysBack = 30;
  }

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysBack + 1);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = now.toISOString().split("T")[0];

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("completed_at, plant_quantity")
    .eq("org_id", orgId)
    .eq("assigned_to", userId)
    .eq("status", "completed")
    .gte("completed_at", `${startStr}T00:00:00`)
    .lte("completed_at", `${endStr}T23:59:59.999`);

  if (error) {
    logError("[api/worker/stats] Error fetching history", { error });
    return [];
  }

  // Group by date
  const dateMap = new Map<string, { tasks: number; plants: number }>();

  // Initialize all dates
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    dateMap.set(dateStr, { tasks: 0, plants: 0 });
  }

  // Populate with actual data
  for (const task of tasks ?? []) {
    if (task.completed_at) {
      const dateStr = task.completed_at.split("T")[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.tasks++;
        existing.plants += task.plant_quantity ?? 0;
      }
    }
  }

  // Convert to array
  const history: HistoryEntry[] = [];
  for (const [date, data] of dateMap.entries()) {
    history.push({
      date,
      tasksCompleted: data.tasks,
      plantsProcessed: data.plants,
    });
  }

  // Sort by date
  history.sort((a, b) => a.date.localeCompare(b.date));

  return history;
}
