"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heart, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export type HealthStatusLevel = "healthy" | "attention" | "critical" | "unknown";

export interface HealthIndicatorProps {
  level: HealthStatusLevel;
  lastEventAt?: string | null;
  lastEventType?: string | null;
  activeIssuesCount?: number;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  onClick?: () => void;
  className?: string;
}

const levelConfig: Record<
  HealthStatusLevel,
  {
    color: string;
    bgColor: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  healthy: {
    color: "text-emerald-600",
    bgColor: "bg-emerald-500",
    icon: CheckCircle2,
    label: "Healthy",
  },
  attention: {
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    icon: AlertTriangle,
    label: "Needs Attention",
  },
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-500",
    icon: AlertCircle,
    label: "Critical Issues",
  },
  unknown: {
    color: "text-gray-400",
    bgColor: "bg-gray-400",
    icon: Heart,
    label: "Unknown",
  },
};

const sizeConfig = {
  sm: {
    dot: "h-2 w-2",
    icon: "h-3 w-3",
    container: "h-4 w-4",
  },
  md: {
    dot: "h-2.5 w-2.5",
    icon: "h-4 w-4",
    container: "h-5 w-5",
  },
  lg: {
    dot: "h-3 w-3",
    icon: "h-5 w-5",
    container: "h-6 w-6",
  },
};

export function HealthIndicator({
  level,
  lastEventAt,
  lastEventType,
  activeIssuesCount = 0,
  size = "md",
  showTooltip = true,
  onClick,
  className,
}: HealthIndicatorProps) {
  const config = levelConfig[level];
  const sizes = sizeConfig[size];

  const indicator = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        sizes.container,
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        !onClick && "cursor-default",
        className
      )}
      aria-label={`Health status: ${config.label}`}
    >
      <span
        className={cn(
          "absolute rounded-full",
          sizes.dot,
          config.bgColor,
          level !== "healthy" && level !== "unknown" && "animate-pulse"
        )}
      />
      {/* Ring around critical/attention */}
      {(level === "critical" || level === "attention") && (
        <span
          className={cn(
            "absolute rounded-full opacity-40",
            level === "critical" ? "bg-red-500" : "bg-amber-500",
            size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5"
          )}
        />
      )}
    </button>
  );

  if (!showTooltip) {
    return indicator;
  }

  const formatEventType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1">
            <div className={cn("font-medium flex items-center gap-1", config.color)}>
              <config.icon className="h-3.5 w-3.5" />
              {config.label}
            </div>
            {activeIssuesCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {activeIssuesCount} unresolved issue{activeIssuesCount !== 1 ? "s" : ""}
              </div>
            )}
            {lastEventAt && (
              <div className="text-xs text-muted-foreground">
                Last: {lastEventType && formatEventType(lastEventType)}
                <br />
                {format(parseISO(lastEventAt), "MMM d, yyyy")}
              </div>
            )}
            {level === "healthy" && !lastEventAt && (
              <div className="text-xs text-muted-foreground">No recent issues</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Dot-only variant for compact displays (e.g., table rows)
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
        config.bgColor,
        level !== "healthy" && level !== "unknown" && "animate-pulse",
        className
      )}
      aria-label={`Health: ${config.label}`}
    />
  );
}

export default HealthIndicator;
