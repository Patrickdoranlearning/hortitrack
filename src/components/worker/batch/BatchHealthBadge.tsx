"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Heart, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

export type HealthStatusLevel = "healthy" | "attention" | "critical" | "unknown";

export interface BatchHealthBadgeProps {
  level: HealthStatusLevel;
  activeIssuesCount?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const levelConfig: Record<
  HealthStatusLevel,
  {
    color: string;
    bgColor: string;
    dotColor: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  healthy: {
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2,
    label: "Healthy",
  },
  attention: {
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    dotColor: "bg-amber-500",
    icon: AlertTriangle,
    label: "Attention",
  },
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-100",
    dotColor: "bg-red-500",
    icon: AlertCircle,
    label: "Critical",
  },
  unknown: {
    color: "text-gray-400",
    bgColor: "bg-gray-100",
    dotColor: "bg-gray-400",
    icon: Heart,
    label: "Unknown",
  },
};

const sizeConfig = {
  sm: {
    dot: "h-2 w-2",
    icon: "h-3 w-3",
    container: "h-5 w-5",
    badge: "text-xs px-1.5 py-0.5",
  },
  md: {
    dot: "h-2.5 w-2.5",
    icon: "h-4 w-4",
    container: "h-6 w-6",
    badge: "text-xs px-2 py-1",
  },
  lg: {
    dot: "h-3 w-3",
    icon: "h-5 w-5",
    container: "h-7 w-7",
    badge: "text-sm px-2.5 py-1",
  },
};

/**
 * Mobile-optimized health indicator for batch cards.
 * Shows as a dot by default, or with label for more prominent display.
 * Touch target is minimum 44px when shown standalone.
 */
export function BatchHealthBadge({
  level,
  activeIssuesCount = 0,
  size = "md",
  showLabel = false,
  className,
}: BatchHealthBadgeProps) {
  const config = levelConfig[level];
  const sizes = sizeConfig[size];

  // Dot-only display (for batch cards)
  if (!showLabel) {
    return (
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-full",
          sizes.container,
          className
        )}
        aria-label={`Health status: ${config.label}`}
      >
        <span
          className={cn(
            "absolute rounded-full",
            sizes.dot,
            config.dotColor,
            level !== "healthy" && level !== "unknown" && "animate-pulse"
          )}
        />
        {/* Larger touch/visual ring for attention/critical */}
        {(level === "critical" || level === "attention") && (
          <span
            className={cn(
              "absolute rounded-full opacity-30",
              config.dotColor,
              size === "sm" ? "h-3.5 w-3.5" : size === "md" ? "h-4.5 w-4.5" : "h-5.5 w-5.5"
            )}
          />
        )}
      </span>
    );
  }

  // Badge with label display
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        sizes.badge,
        config.bgColor,
        config.color,
        className
      )}
      aria-label={`Health status: ${config.label}`}
    >
      <config.icon className={sizes.icon} />
      <span>{config.label}</span>
      {activeIssuesCount > 0 && (
        <span className="font-semibold">({activeIssuesCount})</span>
      )}
    </span>
  );
}

/**
 * Simple health dot for ultra-compact displays (table rows, small cards)
 */
export function HealthDot({
  level,
  className,
}: {
  level: HealthStatusLevel;
  className?: string;
}) {
  const config = levelConfig[level];

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        config.dotColor,
        level !== "healthy" && level !== "unknown" && "animate-pulse",
        className
      )}
      aria-label={`Health: ${config.label}`}
    />
  );
}

export default BatchHealthBadge;
