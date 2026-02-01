"use client";

import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month";

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

/**
 * Period selector tabs for stats dashboard
 */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div className="flex bg-muted rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onChange(period.key)}
          className={cn(
            "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            "min-h-[44px]",
            value === period.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
