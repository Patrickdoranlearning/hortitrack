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

export interface SelectOption {
  value: string;
  label: string;
  /** Optional secondary text shown below the label */
  description?: string;
}

export interface SearchableSelectProps {
  /** Array of selectable options */
  options: SelectOption[];
  /** Currently selected value */
  value?: string;
  /** Called when selection changes */
  onValueChange: (value: string) => void;
  /** URL to open in a new tab when "Add new" is clicked */
  createHref?: string;
  /** Label for the create action (defaults to "Add new") */
  createLabel?: string;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Placeholder text in the search input */
  searchPlaceholder?: string;
  /** Message to show when no options match the search */
  emptyMessage?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Optional className for the trigger button */
  className?: string;
}

/**
 * A searchable select component with an optional "Add new" action.
 * Replaces SelectWithCreate with full search/filter capability.
 *
 * @example
 * ```tsx
 * <SearchableSelect
 *   options={sizes.map(s => ({ value: s.id, label: s.name }))}
 *   value={selectedSize}
 *   onValueChange={setSelectedSize}
 *   createHref="/sizes"
 *   placeholder="Search sizes..."
 * />
 * ```
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  createHref,
  createLabel = "Add new",
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Find selected option for display
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchLower) ||
        opt.description?.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearch("");
  };

  const handleCreateAction = () => {
    if (createHref) {
      window.open(createHref, "_blank", "noopener,noreferrer");
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
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
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
            {filteredOptions.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {createHref && (
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
                  {createLabel}
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
