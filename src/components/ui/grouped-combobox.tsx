"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface GroupedOption<T = unknown> {
  value: string;
  label: string;
  group: string;
  data?: T;
}

export interface GroupedComboboxProps<T = unknown> {
  options: GroupedOption<T>[];
  value?: string;
  onSelect: (option: GroupedOption<T>) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Custom display text for the selected value in the trigger button */
  displayValue?: string;
  /** Render custom content for each option */
  renderOption?: (option: GroupedOption<T>) => React.ReactNode;
  /** Render custom content for group headers */
  renderGroupHeader?: (group: string, count: number) => React.ReactNode;
  /** Action to show at bottom (e.g., "Create new") */
  createAction?: {
    label: string;
    href?: string;
    onAction?: (searchTerm: string) => void;
  };
  /** Sort groups by name (default: true) */
  sortGroups?: boolean;
  /** Group name to show for items with null/undefined group */
  fallbackGroup?: string;
  /** Optional className for the trigger button */
  triggerClassName?: string;
}

export function GroupedCombobox<T = unknown>({
  options,
  value,
  onSelect,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  displayValue,
  renderOption,
  renderGroupHeader,
  createAction,
  sortGroups = true,
  fallbackGroup = "Other",
  triggerClassName,
}: GroupedComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Find selected option for display
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter and group options
  const groupedOptions = useMemo(() => {
    const searchLower = search.toLowerCase();
    const groups = new Map<string, GroupedOption<T>[]>();

    for (const option of options) {
      // Filter by search term (match against label or group name)
      if (searchLower && !option.label.toLowerCase().includes(searchLower) && !option.group.toLowerCase().includes(searchLower)) {
        continue;
      }

      const group = option.group || fallbackGroup;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(option);
    }

    // Convert to array and sort
    let entries = Array.from(groups.entries());

    if (sortGroups) {
      entries = entries.sort(([a], [b]) => {
        // Put fallback group last
        if (a === fallbackGroup) return 1;
        if (b === fallbackGroup) return -1;
        return a.localeCompare(b);
      });
    }

    return entries;
  }, [options, fallbackGroup, sortGroups, search]);

  const handleSelect = (selectedValue: string) => {
    const option = options.find((opt) => opt.value === selectedValue);
    if (option) {
      onSelect(option);
      setOpen(false);
      setSearch("");
    }
  };

  const handleCreateAction = () => {
    if (createAction?.href) {
      window.open(createAction.href, "_blank", "noopener,noreferrer");
    }
    if (createAction?.onAction) {
      createAction.onAction(search);
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", triggerClassName)}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? (displayValue || selectedOption.label) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <CommandList>
            {groupedOptions.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}
            {groupedOptions.map(([group, groupOptions]) => (
              <CommandGroup
                key={group}
                heading={
                  renderGroupHeader
                    ? renderGroupHeader(group, groupOptions.length)
                    : `${group} (${groupOptions.length})`
                }
              >
                {groupOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {renderOption ? (
                      renderOption(option)
                    ) : (
                      <span className="truncate">{option.label}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {createAction && (
              <>
                <CommandSeparator />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleCreateAction}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCreateAction();
                    }
                  }}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none",
                    "text-primary hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  )}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createAction.label}
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
