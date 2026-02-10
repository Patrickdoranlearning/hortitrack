"use client";

import * as React from "react";
import { useMemo } from "react";
import { GroupedCombobox, GroupedOption } from "./grouped-combobox";

export interface VarietyData {
  id: string;
  name: string;
  family: string | null;
  genus?: string | null;
  species?: string | null;
  category?: string | null;
}

interface VarietyComboboxGroupedProps {
  /** Array of varieties to display */
  varieties: VarietyData[];
  /** Currently selected variety ID */
  value?: string;
  /** Called when a variety is selected. Receives the variety ID. */
  onSelect: (varietyId: string) => void;
  /** Placeholder text when no variety is selected */
  placeholder?: string;
  /** Placeholder text in the search input */
  searchPlaceholder?: string;
  /** Message to show when no varieties match the search */
  emptyMessage?: string;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** URL to navigate to for creating a new variety */
  createHref?: string;
  /** Label for the create action */
  createLabel?: string;
  /** Optional className for the trigger button */
  triggerClassName?: string;
}

/**
 * A variety selection combobox with family grouping.
 * Groups varieties by their family field, with ungrouped varieties appearing in "Other".
 * Includes search functionality and optional create action.
 *
 * @example
 * ```tsx
 * <VarietyComboboxGrouped
 *   varieties={referenceData.varieties}
 *   value={selectedVarietyId}
 *   onSelect={(id) => setSelectedVarietyId(id)}
 *   createHref="/varieties"
 * />
 * ```
 */
export function VarietyComboboxGrouped({
  varieties,
  value,
  onSelect,
  placeholder = "Select a variety",
  searchPlaceholder = "Search varieties...",
  emptyMessage = "No varieties found.",
  disabled = false,
  createHref,
  createLabel = "Add new variety",
  triggerClassName,
}: VarietyComboboxGroupedProps) {
  // Transform varieties into grouped options
  const options: GroupedOption<VarietyData>[] = useMemo(() => {
    return varieties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((variety) => ({
        value: variety.id,
        label: variety.name,
        group: variety.family || "Other",
        data: variety,
      }));
  }, [varieties]);

  // Find selected variety for display
  const selectedVariety = useMemo(
    () => varieties.find((v) => v.id === value),
    [varieties, value]
  );

  // Custom option renderer to show variety details
  const renderOption = (option: GroupedOption<VarietyData>) => {
    const variety = option.data;
    return (
      <div className="flex flex-col">
        <span className="font-medium">{option.label}</span>
        {variety && (variety.genus || variety.category) && (
          <span className="text-xs text-muted-foreground">
            {[variety.genus, variety.category].filter(Boolean).join(" - ")}
          </span>
        )}
      </div>
    );
  };

  // Custom group header renderer
  const renderGroupHeader = (group: string, count: number) => {
    return `${group} (${count})`;
  };

  return (
    <GroupedCombobox<VarietyData>
      options={options}
      value={value}
      onSelect={(option) => onSelect(option.value)}
      placeholder={placeholder}
      displayValue={
        selectedVariety
          ? `${selectedVariety.name}${selectedVariety.family ? ` - ${selectedVariety.family}` : ""}`
          : undefined
      }
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      renderOption={renderOption}
      renderGroupHeader={renderGroupHeader}
      createAction={
        createHref
          ? {
              label: createLabel,
              href: createHref,
            }
          : undefined
      }
      fallbackGroup="Other"
      sortGroups={true}
      triggerClassName={triggerClassName}
    />
  );
}
