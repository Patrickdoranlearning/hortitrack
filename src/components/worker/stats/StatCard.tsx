"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: number | string;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  } | null;
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning";
  formatValue?: (value: number | string) => string;
}

/**
 * Reusable stat card for displaying a single metric
 */
export function StatCard({
  value,
  label,
  trend,
  icon,
  variant = "default",
  formatValue,
}: StatCardProps) {
  const variantStyles = {
    default: "bg-card border",
    primary: "bg-primary/10 border-primary/20",
    success: "bg-green-500/10 border-green-500/20",
    warning: "bg-yellow-500/10 border-yellow-500/20",
  };

  const displayValue = formatValue
    ? formatValue(value)
    : typeof value === "number"
    ? value.toLocaleString()
    : value;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col items-center text-center",
        variantStyles[variant]
      )}
    >
      {/* Icon if provided */}
      {icon && (
        <div className="mb-2 text-muted-foreground">
          {icon}
        </div>
      )}

      {/* Main value */}
      <div className="text-2xl font-bold tabular-nums">
        {displayValue}
      </div>

      {/* Label */}
      <div className="text-sm text-muted-foreground mt-1">
        {label}
      </div>

      {/* Trend indicator */}
      {trend !== undefined && trend !== null && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs mt-2",
            trend.isPositive
              ? "text-green-600 dark:text-green-400"
              : trend.value === 0
              ? "text-muted-foreground"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {trend.value > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : trend.value < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          <span>
            {trend.value > 0 ? "+" : ""}
            {trend.value}%
          </span>
        </div>
      )}
    </div>
  );
}
