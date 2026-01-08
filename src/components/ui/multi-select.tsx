"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  triggerClassName?: string;
  maxDisplayed?: number;
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = "Select...",
  emptyMessage = "No results found.",
  triggerClassName,
  maxDisplayed = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedOptions = options.filter((opt) => values.includes(opt.value));

  const handleSelect = React.useCallback(
    (selectedLabel: string) => {
      // cmdk passes the lowercased label, so we need to find the option by label
      const option = options.find(
        (opt) => opt.label.toLowerCase() === selectedLabel.toLowerCase()
      );
      if (!option) return;

      const selectedValue = option.value;
      if (values.includes(selectedValue)) {
        onChange(values.filter((v) => v !== selectedValue));
      } else {
        onChange([...values, selectedValue]);
      }
    },
    [values, onChange, options]
  );

  const handleRemove = React.useCallback(
    (valueToRemove: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(values.filter((v) => v !== valueToRemove));
    },
    [values, onChange]
  );

  const displayLabel = () => {
    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (selectedOptions.length <= maxDisplayed) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt) => (
            <Badge
              key={opt.value}
              variant="secondary"
              className="text-xs px-1.5 py-0"
            >
              {opt.label}
              <span
                role="button"
                tabIndex={0}
                className="ml-1 hover:text-destructive cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => handleRemove(opt.value, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(values.filter((v) => v !== opt.value));
                  }
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <span>
        {selectedOptions.length} selected
      </span>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal min-h-9 h-auto",
            triggerClassName
          )}
        >
          <div className="flex-1 text-left">{displayLabel()}</div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      values.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
