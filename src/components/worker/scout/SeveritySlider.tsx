"use client";

import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";

export type Severity = "low" | "medium" | "critical";

interface SeverityOption {
  value: Severity;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SEVERITY_OPTIONS: SeverityOption[] = [
  {
    value: "low",
    label: "Low",
    sublabel: "Monitor",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    borderColor: "border-green-500",
  },
  {
    value: "medium",
    label: "Medium",
    sublabel: "Treat soon",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-500",
  },
  {
    value: "critical",
    label: "Critical",
    sublabel: "Act now",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-500",
  },
];

interface SeveritySliderProps {
  value: Severity;
  onChange: (severity: Severity) => void;
  disabled?: boolean;
}

export function SeveritySlider({
  value,
  onChange,
  disabled = false,
}: SeveritySliderProps) {
  const handleSelect = (severity: Severity) => {
    if (disabled) return;
    vibrateTap();
    onChange(severity);
  };

  return (
    <div className="space-y-2">
      {/* Visual severity bar */}
      <div className="flex h-4 rounded-full overflow-hidden">
        <div
          className={cn(
            "flex-1 transition-all",
            value === "low" ? "bg-green-500" : "bg-green-200 dark:bg-green-900/50"
          )}
        />
        <div
          className={cn(
            "flex-1 transition-all",
            value === "medium" ? "bg-amber-500" : "bg-amber-200 dark:bg-amber-900/50"
          )}
        />
        <div
          className={cn(
            "flex-1 transition-all",
            value === "critical" ? "bg-red-500" : "bg-red-200 dark:bg-red-900/50"
          )}
        />
      </div>

      {/* Severity buttons */}
      <div className="flex gap-2">
        {SEVERITY_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex-1 py-3 px-2 rounded-lg transition-all border-2",
                "active:scale-95 touch-manipulation",
                "min-h-[60px] flex flex-col items-center justify-center",
                isSelected
                  ? `${option.bgColor} ${option.borderColor} ${option.color}`
                  : "bg-muted/50 border-transparent hover:border-border text-muted-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="font-semibold text-base">{option.label}</span>
              <span className="text-xs opacity-80">{option.sublabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getSeverityLabel(severity: Severity): string {
  const option = SEVERITY_OPTIONS.find((o) => o.value === severity);
  return option?.label ?? severity;
}

export function getSeverityColor(severity: Severity): string {
  const option = SEVERITY_OPTIONS.find((o) => o.value === severity);
  return option?.color ?? "";
}
