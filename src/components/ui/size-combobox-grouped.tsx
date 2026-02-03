"use client";

import * as React from "react";
import { useMemo } from "react";
import { GroupedCombobox, GroupedOption } from "./grouped-combobox";
import { Badge } from "./badge";

export interface SizeData {
  id: string;
  name: string;
  container_type: string;
  cell_multiple: number;
}

interface SizeComboboxGroupedProps {
  /** Array of sizes to display */
  sizes: SizeData[];
  /** Currently selected size ID */
  value?: string;
  /** Called when a size is selected. Receives the size ID. */
  onSelect: (sizeId: string) => void;
  /** Placeholder text when no size is selected */
  placeholder?: string;
  /** Placeholder text in the search input */
  searchPlaceholder?: string;
  /** Message to show when no sizes match the search */
  emptyMessage?: string;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** URL to navigate to for creating a new size */
  createHref?: string;
  /** Label for the create action */
  createLabel?: string;
  /** Optional className for the trigger button */
  triggerClassName?: string;
}

// Map container types to friendly display names
const containerTypeLabels: Record<string, string> = {
  pot: "Pots",
  tray: "Trays",
  plug_tray: "Plug Trays",
  prop_tray: "Propagation Trays",
  liner: "Liners",
  bare_root: "Bare Root",
  other: "Other",
};

function getContainerTypeLabel(type: string): string {
  return containerTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

/**
 * A size selection combobox with container type grouping.
 * Groups sizes by their container_type field (Pots, Trays, Plug Trays, etc.).
 * Includes search functionality and optional create action.
 *
 * @example
 * ```tsx
 * <SizeComboboxGrouped
 *   sizes={referenceData.sizes}
 *   value={selectedSizeId}
 *   onSelect={(id) => setSelectedSizeId(id)}
 *   createHref="/sizes"
 * />
 * ```
 */
export function SizeComboboxGrouped({
  sizes,
  value,
  onSelect,
  placeholder = "Select a size",
  searchPlaceholder = "Search sizes...",
  emptyMessage = "No sizes found.",
  disabled = false,
  createHref,
  createLabel = "Add new size",
  triggerClassName,
}: SizeComboboxGroupedProps) {
  // Transform sizes into grouped options
  const options: GroupedOption<SizeData>[] = useMemo(() => {
    return sizes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((size) => ({
        value: size.id,
        label: size.name,
        group: getContainerTypeLabel(size.container_type),
        data: size,
      }));
  }, [sizes]);

  // Find selected size for display
  const selectedSize = useMemo(
    () => sizes.find((s) => s.id === value),
    [sizes, value]
  );

  // Custom option renderer to show size details
  const renderOption = (option: GroupedOption<SizeData>) => {
    const size = option.data;
    return (
      <div className="flex items-center justify-between w-full">
        <span>{option.label}</span>
        {size && size.cell_multiple > 1 && (
          <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5">
            {size.cell_multiple} cells
          </Badge>
        )}
      </div>
    );
  };

  // Custom group header renderer
  const renderGroupHeader = (group: string, count: number) => {
    return `${group} (${count})`;
  };

  // Build placeholder text
  const displayPlaceholder = selectedSize
    ? `${selectedSize.name}${selectedSize.cell_multiple > 1 ? ` (${selectedSize.cell_multiple} cells)` : ""}`
    : placeholder;

  return (
    <GroupedCombobox<SizeData>
      options={options}
      value={value}
      onSelect={(option) => onSelect(option.value)}
      placeholder={displayPlaceholder}
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
