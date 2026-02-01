"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekSelector, DaySection } from "@/components/worker/schedule";
import { cn } from "@/lib/utils";
import type { ScheduleResponse } from "@/types/worker";

export default function WorkerSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);

  // Calculate current week start for comparison
  const getCurrentWeekStart = useCallback((): string => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(monday.getDate() + diff);
    return monday.toISOString().split("T")[0];
  }, []);

  const fetchSchedule = useCallback(
    async (weekStartParam?: string, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const params = new URLSearchParams();
        if (weekStartParam) {
          params.set("weekStart", weekStartParam);
        }

        const url = `/api/worker/schedule${params.toString() ? `?${params}` : ""}`;
        const response = await fetch(url);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch schedule");
        }

        const data: ScheduleResponse = await response.json();
        setSchedule(data);
        setWeekStart(data.weekStart);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedule");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleRefresh = () => {
    fetchSchedule(weekStart ?? undefined, true);
  };

  const handlePreviousWeek = () => {
    if (!schedule) return;
    const prevWeek = new Date(schedule.weekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevWeekStr = prevWeek.toISOString().split("T")[0];
    fetchSchedule(prevWeekStr);
  };

  const handleNextWeek = () => {
    if (!schedule) return;
    const nextWeek = new Date(schedule.weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];
    fetchSchedule(nextWeekStr);
  };

  const handleThisWeek = () => {
    fetchSchedule();
  };

  const isCurrentWeek = schedule?.weekStart === getCurrentWeekStart();

  // Calculate week totals
  const weekTotals = schedule
    ? schedule.days.reduce(
        (acc, day) => ({
          total: acc.total + day.stats.total,
          completed: acc.completed + day.stats.completed,
        }),
        { total: 0, completed: 0 }
      )
    : { total: 0, completed: 0 };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Schedule</h2>
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

      {/* Loading State */}
      {loading && !schedule && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchSchedule()} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Schedule Content */}
      {!loading && !error && schedule && (
        <>
          {/* Week Selector */}
          <WeekSelector
            weekStart={schedule.weekStart}
            weekEnd={schedule.weekEnd}
            onPreviousWeek={handlePreviousWeek}
            onNextWeek={handleNextWeek}
            onThisWeek={handleThisWeek}
            isCurrentWeek={isCurrentWeek}
          />

          {/* Week Summary */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Week Total</span>
            <div className="flex items-center gap-2">
              <span className="font-medium tabular-nums">
                {weekTotals.completed} / {weekTotals.total}
              </span>
              <span className="text-sm text-muted-foreground">completed</span>
            </div>
          </div>

          {/* Day Sections */}
          <div className="space-y-3">
            {schedule.days.map((day) => (
              <DaySection
                key={day.date}
                date={day.date}
                dayName={day.dayName}
                isToday={day.isToday}
                tasks={day.tasks}
                stats={day.stats}
                defaultExpanded={day.isToday}
                onTaskUpdate={handleRefresh}
              />
            ))}
          </div>

          {/* Empty Week State */}
          {weekTotals.total === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Tasks This Week</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                You have no tasks scheduled for this week. Check back later or
                contact your supervisor.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
