'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

export type VarietyOption = {
  id: string;
  name: string;
  family: string;
  category: string;
};

export function VarietyCombobox(props: {
  options: VarietyOption[];
  selectedId?: string | null;
  placeholder?: string;
  disabled?: boolean;
  // When user picks an existing option
  onSelect: (variety: VarietyOption) => void;
  // When user clicks create (free text)
  onCreateOption?: (name: string) => void;
}) {
  const {
    options,
    selectedId,
    placeholder = 'Select variety',
    disabled,
    onSelect,
    onCreateOption,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selected = React.useMemo(
    () => options.find((o) => o.id === selectedId) || null,
    [options, selectedId]
  );

  // Does the query match an existing option?
  const matchExists = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return options.some((o) => o.name.toLowerCase() === q);
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', disabled && 'opacity-60')}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <span className="truncate">{selected.name}</span>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {selected.family}
                </Badge>
                <Badge variant="outline" className="hidden md:inline-flex">
                  {selected.category}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px]">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search varieties…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Varieties">
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  // DO NOT pass disabled
                  onSelect={() => {
                    onSelect(opt);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="truncate">
                    <div className="font-medium truncate">{opt.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {opt.family} • {opt.category}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4',
                      selected?.id === opt.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>

            {onCreateOption && !matchExists && query.trim() && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onCreateOption(query.trim());
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create “{query.trim()}”
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
