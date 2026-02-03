'use client';

import * as React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type VarietyOption = {
  id?: string;
  name: string;
  family?: string;
  category?: string;
};

type Props = {
  value: string;
  varieties: VarietyOption[];
  onSelect: (v: VarietyOption) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

export function VarietyCombobox({
  value,
  varieties,
  onSelect,
  onCreate,
  placeholder = "Search variety...",
  emptyMessage = "No results.",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const items = useMemo(
    () =>
      varieties
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [varieties]
  );

  const current = items.find((v) => v.name === value);

  const handleCreate = (name: string) => {
    onCreate?.(name);
    // optional: immediately select it in the form
    onSelect({ name });
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearch("");
    }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {current ? current.name : "Select variety"}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="p-3 text-sm text-muted-foreground">
              {emptyMessage}
              {onCreate && search.trim() && (
                <div className="mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleCreate(search.trim())}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create &quot;{search.trim()}&quot;
                  </Button>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup heading="Varieties">
              {items.map((v) => (
                <CommandItem
                  key={v.id ?? v.name}
                  value={v.name}
                  onSelect={() => {
                    onSelect(v);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", v.name === value ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.family || "—"} • {v.category || "—"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}