// src/components/ui/AsyncCombobox.tsx
"use client";
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; meta?: Record<string, unknown> };

export function AsyncCombobox({
  endpoint,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No results.",
  className,
}: {
  endpoint: `/api/options/${"varieties"|"sizes"|"locations"|"suppliers"}`;
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [label, setLabel] = React.useState<string>("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetcher = React.useCallback(async (q: string) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0,180)}`);
      }
      if (!res.ok) {
        throw new Error(payload?.error || `Request failed with ${res.status}`);
      }
      const opts: Option[] = payload.options ?? [];
      setOptions(opts);
      if (value && !label) {
        const m = opts.find(o => o.value === value);
        if (m) setLabel(m.label);
      }
    } catch (e: any) {
      setOptions([]);
      setErrorMsg(e?.message || "Failed to load options");
      console.error("[AsyncCombobox] load error:", e);
    } finally {
      setBusy(false);
    }
  }, [endpoint, value, label]);


  // initial load when opened
  React.useEffect(() => { if (open) fetcher(""); }, [open, fetcher]);

  // keep label in sync if value changes externally
  React.useEffect(() => {
    if (!value) setLabel("");
    else {
      const m = options.find(o => o.value === value);
      if (m) setLabel(m.label);
    }
  }, [value, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between", className)}>
          {label || "Select…"}
          {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command
          filter={(value, search, keywords) => 1} // server-side filtered
          shouldFilter={false}
        >
          <CommandInput
            placeholder={placeholder}
            onValueChange={(q) => {
              const t = setTimeout(() => fetcher(q), 250);
              return () => clearTimeout(t);
            }}
          />
          <CommandList>
            <CommandEmpty>
              {busy ? "Searching…" : (errorMsg ?? emptyText)}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onChange(opt.value);
                    setLabel(opt.label);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
