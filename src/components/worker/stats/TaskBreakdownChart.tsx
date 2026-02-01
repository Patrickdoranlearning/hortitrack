"use client";

import { cn } from "@/lib/utils";

interface TaskBreakdownChartProps {
  breakdown: {
    production: number;
    dispatch: number;
    plantHealth: number;
  };
}

interface BreakdownItem {
  key: string;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

/**
 * Horizontal bar chart showing task distribution by module
 */
export function TaskBreakdownChart({ breakdown }: TaskBreakdownChartProps) {
  const total = breakdown.production + breakdown.dispatch + breakdown.plantHealth;

  if (total === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="font-medium mb-3">Task Breakdown</h3>
        <p className="text-sm text-muted-foreground text-center py-4">
          No completed tasks yet
        </p>
      </div>
    );
  }

  const items: BreakdownItem[] = [
    {
      key: "production",
      label: "Production",
      value: breakdown.production,
      color: "bg-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "dispatch",
      label: "Dispatch",
      value: breakdown.dispatch,
      color: "bg-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      key: "plantHealth",
      label: "Plant Health",
      value: breakdown.plantHealth,
      color: "bg-green-500",
      bgColor: "bg-green-500/10",
    },
  ].filter((item) => item.value > 0);

  // Sort by value descending
  items.sort((a, b) => b.value - a.value);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-4">Task Breakdown</h3>

      <div className="space-y-4">
        {items.map((item) => {
          const percentage = Math.round((item.value / total) * 100);
          return (
            <div key={item.key}>
              {/* Label and count */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {item.value} ({percentage}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className={cn("h-3 rounded-full overflow-hidden", item.bgColor)}>
                <div
                  className={cn("h-full rounded-full transition-all duration-500", item.color)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total at bottom */}
      <div className="mt-4 pt-3 border-t flex justify-between text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-medium tabular-nums">{total} tasks</span>
      </div>
    </div>
  );
}
