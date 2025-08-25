
"use client";
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Plus } from "lucide-react";

type Item = { id: string; name: string } & Record<string, any>;

type Props = {
  label: string;
  value: Item | null;
  onChange: (item: Item | null) => void;
  entity: "varieties" | "sizes" | "locations" | "suppliers";
  orgId: string;
  trayOnly?: boolean;
  quickAdd?: React.ReactNode;
  placeholder?: string;
};

export function ComboBoxEntity({ label, value, onChange, entity, orgId, trayOnly, quickAdd, placeholder }: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const ctrlRef = React.useRef<AbortController | null>(null);
  const mountedRef = React.useRef(true);
  React.useEffect(() => () => { mountedRef.current = false; }, []);

  React.useEffect(() => {
    if (!orgId) { setItems([]); return; }
    const t = setTimeout(async () => {
      // cancel any in-flight request
      ctrlRef.current?.abort();
      const controller = new AbortController();
      ctrlRef.current = controller;

      try {
        setLoading(true);
        const url = `/api/search/${entity}?q=${encodeURIComponent(q)}&orgId=${encodeURIComponent(orgId)}${trayOnly ? "&trayOnly=1" : ""}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          // Try to capture body for debugging in dev, but never throw
          const body = await res.text().catch(() => "");
          console.warn(`[ComboBoxEntity] ${entity} search failed`, { status: res.status, body });
          setItems([]);
          return;
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const body = await res.text().catch(() => "");
          console.warn(`[ComboBoxEntity] ${entity} non-JSON response`, { ct, bodyPreview: body.slice(0, 140) });
          setItems([]);
          return;
        }

        let data: unknown = [];
        try {
          data = await res.json();
        } catch (e) {
          console.warn(`[ComboBoxEntity] ${entity} JSON parse error`, e);
          data = [];
        }
        if (!mountedRef.current) return;
        setItems(Array.isArray(data) ? (data as Item[]) : []);
      } catch (err: any) {
        if (err?.name === "AbortError") return; // expected
        console.warn(`[ComboBoxEntity] ${entity} fetch error`, err);
        setItems([]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrlRef.current?.abort();
    };
  }, [q, entity, orgId, trayOnly]);

  return (
    <div className="col-span-12">
      <label className="text-sm font-medium">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {value?.name ?? placeholder ?? `Select ${label}`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[420px]">
          <Command>
            <CommandInput value={q} onValueChange={setQ} placeholder={`Search ${label}...`} />
            <CommandList>
              <CommandEmpty>
                {loading
                  ? "Searching..."
                  : q
                    ? (<div className="p-2 flex items-center gap-2">
                         No results.
                         {quickAdd ? <div className="ml-auto">{quickAdd}</div> : null}
                       </div>)
                    : "Type to search"}
              </CommandEmpty>
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem key={it.id} value={it.name} onSelect={() => { onChange(it); setOpen(false); }}>
                    {it.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {quickAdd ? (
                <div className="border-t p-2">
                  <button className="text-sm flex items-center gap-1" onClick={() => {/* open microform via parent */}}>
                    <Plus className="h-4 w-4" /> Add {label}
                  </button>
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
