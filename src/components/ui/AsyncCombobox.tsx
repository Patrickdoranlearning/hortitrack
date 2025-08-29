"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

export type Option = { value: string; label: string; hint?: string; meta?: Record<string, any> };

type Props = {
  endpoint: string;              // e.g. "/api/options/varieties"
  value: string | null;          // stores 'value' (id) in the form
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
};

const AsyncCombobox = React.forwardRef<HTMLButtonElement, Props>(function AsyncCombobox(
  { endpoint, value, onChange, placeholder = "Search…", disabled, debounceMs = 250 }: Props,
  ref
) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [options, setOptions] = React.useState<Option[]>([]);

  const debounced = useDebounce(query, debounceMs);

  const fetcher = React.useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (q) url.searchParams.set("q", q);
      const res = await fetch(url.toString(), { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Request failed with ${res.status}`);
      const opts: Option[] = payload.options ?? [];
      setOptions(opts);
    } catch (e: any) {
      console.error("[AsyncCombobox] fetch error:", e);
      setOptions([]);
      setError(e?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  React.useEffect(() => { fetcher(""); }, [fetcher]);
  React.useEffect(() => { fetcher(debounced); }, [debounced, fetcher]);

  const selected = options.find(o => o.value === value) || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          role="combobox"
          className="justify-between w-full"
          disabled={disabled}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-56">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && <CommandEmpty>Searching…</CommandEmpty>}
            {!loading && error && <CommandEmpty>{error}</CommandEmpty>}
            {!loading && !error && options.length === 0 && <CommandEmpty>No results.</CommandEmpty>}
            {!loading && !error && options.length > 0 && (
              <CommandGroup>
                {options.map(opt => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value);
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
});

export default AsyncCombobox;

function useDebounce<T>(value: T, delay: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}