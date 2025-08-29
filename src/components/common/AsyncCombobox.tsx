// src/components/common/AsyncCombobox.tsx
"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

type Option = { value: string; label: string; hint?: string; meta?: Record<string, any> };

type Props = {
  value?: Option | null;
  onChange: (opt: Option | null) => void;
  fetchUrl: string;           // e.g. "/api/catalog/varieties"
  placeholder?: string;
  disabled?: boolean;
  autofocus?: boolean;
  debounceMs?: number;
};

export function AsyncCombobox({ value, onChange, fetchUrl, placeholder, disabled, autofocus, debounceMs = 250 }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  React.useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(fetchUrl, window.location.origin);
        if (debouncedQuery) url.searchParams.set("q", debouncedQuery);
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Option[] = await res.json();
        if (!ignore) setOptions(data);
      } catch (e: any) {
        if (!ignore && e.name !== "AbortError") {
          console.error("[AsyncCombobox] fetch error", e);
          setError("Failed to load options");
          setOptions([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [fetchUrl, debouncedQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="justify-between w-full" disabled={disabled}>
          <span className="truncate">{value?.label ?? placeholder ?? "Select..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-56">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search..."
            value={query}
            onValueChange={setQuery}
            autoFocus={autofocus}
          />
          <CommandList>
            {loading && <CommandEmpty>Searching…</CommandEmpty>}
            {!loading && error && <CommandEmpty>{error}</CommandEmpty>}
            {!loading && !error && options.length === 0 && <CommandEmpty>No results.</CommandEmpty>}
            {!loading && !error && options.length > 0 && (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{opt.label}</span>
                      {opt.hint && <span className="text-xs text-muted-foreground">{opt.hint}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
