
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

  React.useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const url = new URL(`/api/search/${entity}`, window.location.origin);
      url.searchParams.set("q", q);
      url.searchParams.set("orgId", orgId);
      if (trayOnly) url.searchParams.set("trayOnly", "1");
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
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
                {loading ? "Searching..." : (
                  <div className="p-2 flex items-center gap-2">
                    No results.
                    {quickAdd ? <div className="ml-auto">{quickAdd}</div> : null}
                  </div>
                )}
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
