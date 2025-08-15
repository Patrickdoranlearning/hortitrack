// src/components/variety-combobox.tsx
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export type VarietyOption = {
  id?: string;
  name: string;
  family?: string;
  category?: string;
};

type Props = {
  value: string; // current variety name (not id)
  varieties: VarietyOption[];
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  onSelect: (v: VarietyOption) => void;
  onCreate?: (name: string) => void;
};

export function VarietyCombobox({
  value,
  varieties,
  disabled,
  placeholder = 'Select variety…',
  emptyMessage = 'No results.',
  onSelect,
  onCreate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return varieties;
    return varieties.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.family ?? '').toLowerCase().includes(q) ||
        (v.category ?? '').toLowerCase().includes(q)
    );
  }, [query, varieties]);

  const current = varieties.find((v) => v.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className={cn(!value && 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(32rem,90vw)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search variety, family, or category…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="px-3 py-2 text-sm">{emptyMessage}</div>
              {onCreate && query.trim() && (
                <Button
                  type="button"
                  className="m-2"
                  onClick={() => {
                    const name = query.trim();
                    if (!name) return;
                    onCreate(name);
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create “{query.trim()}”
                </Button>
              )}
            </CommandEmpty>

            <CommandGroup heading="Varieties">
              {filtered.map((v) => (
                <CommandItem
                  key={v.id ?? v.name}
                  value={v.name}
                  onSelect={() => {
                    onSelect(v);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      current?.name === v.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate">{v.name}</div>
                    <div className="mt-1 flex gap-2">
                      {v.family ? (
                        <Badge variant="secondary" className="text-xs">
                          {v.family}
                        </Badge>
                      ) : null}
                      {v.category ? (
                        <Badge variant="outline" className="text-xs">
                          {v.category}
                        </Badge>
                      ) : null}
                    </div>
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