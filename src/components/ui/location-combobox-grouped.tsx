"use client";

import * as React from "react";
import { useMemo } from "react";
import { GroupedCombobox, GroupedOption } from "./grouped-combobox";

export interface LocationData {
  id: string;
  name: string;
  nursery_site: string;
}

interface LocationComboboxGroupedProps {
  /** Array of locations to display */
  locations: LocationData[];
  /** Currently selected location ID */
  value?: string;
  /** Called when a location is selected. Receives the location ID. */
  onSelect: (locationId: string) => void;
  /** Placeholder text when no location is selected */
  placeholder?: string;
  /** Placeholder text in the search input */
  searchPlaceholder?: string;
  /** Message to show when no locations match the search */
  emptyMessage?: string;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** URL to navigate to for creating a new location */
  createHref?: string;
  /** Label for the create action */
  createLabel?: string;
  /** Optional className for the trigger button */
  triggerClassName?: string;
  /** If provided, adds an empty/none option at the top */
  emptyLabel?: string;
  /** Value to use for the empty option (defaults to empty string) */
  emptyValue?: string;
}

/**
 * A location selection combobox with nursery site grouping.
 * Groups locations by their nursery_site field.
 * Includes search functionality and optional create action.
 *
 * @example
 * ```tsx
 * <LocationComboboxGrouped
 *   locations={referenceData.locations}
 *   value={selectedLocationId}
 *   onSelect={(id) => setSelectedLocationId(id)}
 *   createHref="/locations"
 * />
 * ```
 */
export function LocationComboboxGrouped({
  locations,
  value,
  onSelect,
  placeholder = "Select a location",
  searchPlaceholder = "Search locations...",
  emptyMessage = "No locations found.",
  disabled = false,
  createHref,
  createLabel = "Add new location",
  triggerClassName,
  emptyLabel,
  emptyValue = "",
}: LocationComboboxGroupedProps) {
  // Transform locations into grouped options
  const options: GroupedOption<LocationData>[] = useMemo(() => {
    const opts: GroupedOption<LocationData>[] = [];

    // Add empty option first if provided
    if (emptyLabel) {
      opts.push({
        value: emptyValue,
        label: emptyLabel,
        group: "", // Will be filtered out from groups
        data: { id: emptyValue, name: emptyLabel, nursery_site: "" },
      });
    }

    // Add location options
    const sortedLocations = locations
      .slice()
      .sort((a, b) => {
        // Sort by site first, then by name
        const siteCompare = (a.nursery_site || "").localeCompare(b.nursery_site || "");
        if (siteCompare !== 0) return siteCompare;
        return a.name.localeCompare(b.name);
      });

    for (const location of sortedLocations) {
      opts.push({
        value: location.id,
        label: location.name,
        group: location.nursery_site || "Other",
        data: location,
      });
    }

    return opts;
  }, [locations, emptyLabel, emptyValue]);

  // Find selected location for display
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === value),
    [locations, value]
  );

  // Check if empty option is selected
  const isEmptySelected = emptyLabel && value === emptyValue;

  // Custom group header renderer
  const renderGroupHeader = (group: string, count: number) => {
    if (!group) return null; // Don't show header for empty option
    return `${group} (${count})`;
  };

  // Build placeholder text
  const displayPlaceholder = isEmptySelected
    ? emptyLabel
    : selectedLocation
      ? `${selectedLocation.nursery_site ? `${selectedLocation.nursery_site} · ` : ""}${selectedLocation.name}`
      : placeholder;

  return (
    <GroupedCombobox<LocationData>
      options={options}
      value={value}
      onSelect={(option) => onSelect(option.value)}
      placeholder={displayPlaceholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
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
