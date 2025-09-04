
"use client";
import * as React from "react";
import { useController, Control } from "react-hook-form";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useContext, useMemo } from "react";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { ChevronsUpDown } from "lucide-react";


type Option = { id: string; label: string; [k: string]: any };

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Props = {
  name: string;
  control: Control<any>;
  resource: "varieties" | "sizes" | "suppliers" | "locations" | string;
  placeholder?: string;
  value?: string | null;
  onChange?: (opt: Option | null) => void;
  fetcher?: typeof fetch;
};

export function AsyncCombobox({ name, control, resource, placeholder, fetcher = fetch, value, onChange }: Props) {
  const { field } = useController({ name, control });
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebounced(q);
  const [options, setOptions] = React.useState<Option[] | unknown>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const url = `/api/catalog/${resource}?q=${encodeURIComponent(debouncedQ)}`;
        const res = await fetcher(url, { cache: "no-store"});
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!abort) setOptions(data);
      } catch (e) {
        if (!abort) setError(e as Error);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [resource, debouncedQ, fetcher]);


  const list: Option[] = Array.isArray(options) ? (options as Option[]) : [];
  const fieldValue = field.value;
  const selected = list.find(o => o.value === fieldValue) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          {selected ? selected.label : (placeholder ?? "Select...")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." value={q} onValueChange={setQ} />
          <CommandList>
            {loading && <div className="p-3 text-sm">Loading…</div>}
            {!loading && list.length === 0 && <CommandEmpty>No results</CommandEmpty>}
            {list.map(opt => (
              <CommandItem
                key={opt.value}
                onSelect={() => {
                  field.onChange(opt.value);
                  if (onChange) onChange(opt)
                  setOpen(false);
                  setQ("");
                }}
              >
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

