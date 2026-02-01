"use client";

import { Bug, Leaf, Droplets, Thermometer, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";

export type IssueType = "pest" | "disease" | "nutrient" | "water" | "environmental" | "other";

interface IssueOption {
  type: IssueType;
  label: string;
  icon: typeof Bug;
  color: string;
  bgColor: string;
}

const ISSUE_OPTIONS: IssueOption[] = [
  {
    type: "pest",
    label: "Pest",
    icon: Bug,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  {
    type: "disease",
    label: "Disease",
    icon: Leaf,
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    type: "nutrient",
    label: "Nutrient",
    icon: Droplets,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    type: "water",
    label: "Water",
    icon: Droplets,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    type: "environmental",
    label: "Environ.",
    icon: Thermometer,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  {
    type: "other",
    label: "Other",
    icon: HelpCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
];

interface ScoutIssueSelectorProps {
  value: IssueType | null;
  onChange: (type: IssueType) => void;
  disabled?: boolean;
}

export function ScoutIssueSelector({
  value,
  onChange,
  disabled = false,
}: ScoutIssueSelectorProps) {
  const handleSelect = (type: IssueType) => {
    if (disabled) return;
    vibrateTap();
    onChange(type);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {ISSUE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.type;

        return (
          <button
            key={option.type}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(option.type)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl",
              "min-h-[80px] transition-all border-2",
              "active:scale-95 touch-manipulation",
              isSelected
                ? `${option.bgColor} border-current ${option.color}`
                : "bg-muted/50 border-transparent hover:border-border",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon
              className={cn(
                "h-7 w-7",
                isSelected ? option.color : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                isSelected ? option.color : "text-muted-foreground"
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function getIssueLabel(type: IssueType): string {
  const option = ISSUE_OPTIONS.find((o) => o.type === type);
  return option?.label ?? type;
}
