"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional badge or icon to render after the label */
  badge?: React.ReactNode;
}

export interface SelectWithCreateProps {
  /** Array of selectable options */
  options: SelectOption[];
  /** Currently selected value */
  value?: string;
  /** Called when selection changes */
  onValueChange: (value: string) => void;
  /** URL to open in a new tab when "Add new" is clicked */
  createHref: string;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Label for the create action (defaults to "Add new") */
  createLabel?: string;
  /** Optional className for the trigger */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** If provided, adds a clear/empty option at the top with this label */
  emptyLabel?: string;
  /** Value to use for the empty option (defaults to empty string) */
  emptyValue?: string;
}

/**
 * A Select component with an "Add new" option at the bottom.
 * Clicking "Add new" opens the specified URL in a new browser tab,
 * preserving any form data in the current tab.
 *
 * @example
 * ```tsx
 * <SelectWithCreate
 *   options={sizes.map(s => ({ value: s.id, label: s.name }))}
 *   value={selectedSize}
 *   onValueChange={setSelectedSize}
 *   createHref="/sizes"
 *   placeholder="Select a size"
 *   createLabel="Add new size"
 * />
 * ```
 */
export function SelectWithCreate({
  options,
  value,
  onValueChange,
  createHref,
  placeholder = "Select an option",
  createLabel = "Add new",
  className,
  disabled,
  emptyLabel,
  emptyValue = "",
}: SelectWithCreateProps) {
  const handleCreateClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(createHref, "_blank", "noopener,noreferrer");
    },
    [createHref]
  );

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel && (
          <SelectItem value={emptyValue || "__empty__"}>{emptyLabel}</SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option.value || `__empty_${Math.random()}__`} value={option.value || "__invalid_empty_value__"}>
            {option.badge ? (
              <div className="flex items-center justify-between gap-2 w-full">
                <span>{option.label}</span>
                {option.badge}
              </div>
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
        <SelectSeparator />
        <div
          role="button"
          tabIndex={0}
          onClick={handleCreateClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.open(createHref, "_blank", "noopener,noreferrer");
            }
          }}
          className={cn(
            "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
            "text-primary hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <Plus className="h-4 w-4" />
          </span>
          {createLabel}
        </div>
      </SelectContent>
    </Select>
  );
}
