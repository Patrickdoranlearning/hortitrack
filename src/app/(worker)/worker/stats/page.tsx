"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Leaf,
  Zap,
  Clock,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatCard,
  TaskBreakdownChart,
  HistoryChart,
  PeriodSelector,
} from "@/components/worker/stats";
import { cn } from "@/lib/utils";
import type { StatsResponse } from "@/types/worker";

type Period = "today" | "week" | "month";

export default function WorkerStatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(
    async (range: Period, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const response = await fetch(`/api/worker/stats?range=${range}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch stats");
        }

        const data: StatsResponse = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchStats(period);
  }, [fetchStats, period]);

  const handleRefresh = () => {
    fetchStats(period, true);
  };

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    // fetchStats will be called by useEffect when period changes
  };

  // Format hours worked
  const formatHoursWorked = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
  };

  // Get period label for display
  const getPeriodLabel = (): string => {
    switch (period) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
    }
  };

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Stats</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="min-h-[44px] min-w-[44px]"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          <span className="ml-2 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Period Selector */}
      <PeriodSelector value={period} onChange={handlePeriodChange} />

      {/* Loading State */}
      {loading && !stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Stats Content */}
      {!loading && !error && stats && (
        <>
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={stats.summary.tasksCompleted}
              label="Tasks Completed"
              icon={<CheckCircle2 className="h-5 w-5" />}
              variant={stats.summary.tasksCompleted > 0 ? "success" : "default"}
            />

            <StatCard
              value={stats.summary.plantsProcessed}
              label="Plants Processed"
              icon={<Leaf className="h-5 w-5" />}
              trend={
                stats.comparison?.changePercent !== undefined &&
                stats.comparison?.changePercent !== null
                  ? {
                      value: stats.comparison.changePercent,
                      isPositive: stats.comparison.changePercent >= 0,
                    }
                  : null
              }
            />

            <StatCard
              value={stats.summary.avgPlantsPerHour ?? "-"}
              label="Plants/Hour"
              icon={<Zap className="h-5 w-5" />}
              variant={
                stats.summary.avgPlantsPerHour && stats.summary.avgPlantsPerHour > 0
                  ? "primary"
                  : "default"
              }
              formatValue={(v) =>
                typeof v === "number" ? v.toLocaleString() : String(v)
              }
            />

            <StatCard
              value={formatHoursWorked(stats.summary.totalMinutesWorked)}
              label={`Worked ${getPeriodLabel()}`}
              icon={<Clock className="h-5 w-5" />}
            />
          </div>

          {/* Task Breakdown */}
          <TaskBreakdownChart breakdown={stats.breakdown} />

          {/* History Chart */}
          <HistoryChart history={stats.history} metric="tasks" />

          {/* Empty State for No Activity */}
          {stats.summary.tasksCompleted === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/20">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Activity Yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Complete some tasks to see your productivity stats here.
              </p>
            </div>
          )}

          {/* Comparison Note */}
          {stats.comparison && stats.comparison.previousTasksCompleted > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              Compared to previous {period === "today" ? "day" : period}:{" "}
              {stats.comparison.previousTasksCompleted} tasks,{" "}
              {stats.comparison.previousPlantsProcessed.toLocaleString()} plants
            </div>
          )}
        </>
      )}
    </div>
  );
}
