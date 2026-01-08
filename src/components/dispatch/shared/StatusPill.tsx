"use client";

import { cn } from "@/lib/utils";
import { getStatusPillColor } from "@/lib/dispatch/types";

interface StatusPillProps {
  status: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  // Picking stages
  to_pick: "To Pick",
  picking: "Picking",
  ready_to_load: "Ready",
  on_route: "On Route",
  delivered: "Delivered",

  // Pick list status
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",

  // QC status
  qc_pending: "QC Pending",
  qc_passed: "QC Passed",
  qc_failed: "QC Failed",

  // Delivery status
  loading: "Loading",
  in_transit: "In Transit",
  failed: "Failed",
  rescheduled: "Rescheduled",
};

export function StatusPill({
  status,
  label,
  size = "md",
  className,
}: StatusPillProps) {
  const colorClasses = getStatusPillColor(status);
  const displayLabel = label || STATUS_LABELS[status] || status;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        colorClasses,
        sizeClasses[size],
        className
      )}
    >
      {displayLabel}
    </span>
  );
}

interface ProgressPillProps {
  picked: number;
  total: number;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  className?: string;
}

export function ProgressPill({
  picked,
  total,
  size = "md",
  showPercentage = true,
  className,
}: ProgressPillProps) {
  const percentage = total > 0 ? Math.round((picked / total) * 100) : 0;

  // Color based on progress
  let colorClasses: string;
  if (percentage === 100) {
    colorClasses = "bg-green-100 text-green-800 border-green-300";
  } else if (percentage >= 50) {
    colorClasses = "bg-yellow-100 text-yellow-800 border-yellow-300";
  } else if (percentage > 0) {
    colorClasses = "bg-orange-100 text-orange-800 border-orange-300";
  } else {
    colorClasses = "bg-gray-100 text-gray-700 border-gray-300";
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        colorClasses,
        sizeClasses[size],
        className
      )}
    >
      {showPercentage ? `${percentage}%` : `${picked}/${total}`}
    </span>
  );
}
