"use client";

import { cn } from "@/lib/utils";

interface HistoryEntry {
  date: string;
  tasksCompleted: number;
  plantsProcessed: number;
}

interface HistoryChartProps {
  history: HistoryEntry[];
  metric: "tasks" | "plants";
}

/**
 * Simple bar chart showing daily history
 */
export function HistoryChart({ history, metric }: HistoryChartProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="font-medium mb-3">Daily Progress</h3>
        <p className="text-sm text-muted-foreground text-center py-4">
          No history data available
        </p>
      </div>
    );
  }

  // Get values based on metric
  const values = history.map((h) =>
    metric === "tasks" ? h.tasksCompleted : h.plantsProcessed
  );
  const maxValue = Math.max(...values, 1); // Avoid division by zero

  // Get today's date string for highlighting
  const todayStr = new Date().toISOString().split("T")[0];

  // Format date for display (e.g., "Mon")
  const formatDay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { weekday: "short" });
  };

  // Format date for tooltip (e.g., "Jan 27")
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const label = metric === "tasks" ? "Tasks Completed" : "Plants Processed";

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-4">{label}</h3>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-1 h-24">
        {history.map((entry) => {
          const value = metric === "tasks" ? entry.tasksCompleted : entry.plantsProcessed;
          const heightPercent = (value / maxValue) * 100;
          const isToday = entry.date === todayStr;

          return (
            <div
              key={entry.date}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${formatDate(entry.date)}: ${value.toLocaleString()}`}
            >
              {/* Value label on top for non-zero values */}
              {value > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
                </span>
              )}

              {/* Bar */}
              <div className="w-full flex items-end justify-center" style={{ height: "60px" }}>
                <div
                  className={cn(
                    "w-full max-w-[24px] rounded-t transition-all duration-300",
                    isToday
                      ? "bg-primary"
                      : value > 0
                      ? "bg-primary/40"
                      : "bg-muted"
                  )}
                  style={{
                    height: value > 0 ? `${Math.max(heightPercent, 8)}%` : "4px",
                  }}
                />
              </div>

              {/* Day label */}
              <span
                className={cn(
                  "text-[10px] mt-1",
                  isToday ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {formatDay(entry.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
