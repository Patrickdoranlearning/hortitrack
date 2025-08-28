"use client";
import * as React from "react";
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
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchVarieties, searchSizes, searchLocations, searchSuppliers } from "@/server/refdata/queries";

type Entity = "varieties" | "sizes" | "locations" | "suppliers";

export type ComboItem = { id: string; name: string; meta?: Record<string, any> };

type Props = {
  entity: Entity;
  orgId?: string | null;
  trayOnly?: boolean;
  value: ComboItem | null;
  onChange: (item: ComboItem | null) => void;
  placeholder?: string;
  quickAdd?: React.ReactNode;
  loadOnOpen?: boolean;
};

const SEARCH_FN_MAP: Record<Entity, (q: string, orgId?: string) => Promise<any[]>> = {
    varieties: (q, orgId) => searchVarieties(q, orgId),
    sizes: (q, orgId) => searchSizes(q, orgId),
    locations: (q, orgId) => searchLocations(q, orgId),
    suppliers: (q, orgId) => searchSuppliers(q, orgId),
}

export function ComboBoxEntity({
  entity,
  orgId,
  trayOnly,
  value,
  onChange,
  placeholder = "Search…",
  quickAdd,
  loadOnOpen = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ComboItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ctrlRef = React.useRef<AbortController | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
      ctrlRef.current?.abort();
    },
    []
  );

  const requiresOrg = entity === "locations" || entity === "suppliers";

  const fetchItems = React.useCallback(async () => {
    setError(null);
    if (requiresOrg && !orgId) {
      setItems([]);
      return;
    }
    setLoading(true);
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;

    try {
        const searchFn = SEARCH_FN_MAP[entity];
        const results = await searchFn(q, orgId);
        if (!controller.signal.aborted) {
            setItems(results.map(r => ({id: r.id, name: r.name, meta: r})));
        }
    } catch (e: any) {
        if (e?.name !== "AbortError") {
            console.warn(`[ComboBoxEntity] ${entity} error`, e);
            setError(e.message || "Network error");
            setItems([]);
        }
    } finally {
        if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, entity, orgId, requiresOrg]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchItems(), 250);
    return () => clearTimeout(t);
  }, [q, open, fetchItems]);

  React.useEffect(() => {
    if (open && loadOnOpen && items.length === 0) {
      fetchItems();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadOnOpen]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value ? value.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {requiresOrg && !orgId
                ? "Select an organization first"
                : loading
                ? "Searching…"
                : q
                ? error
                  ? `Error: ${error}`
                  : "No results."
                : error
                ? `Error: ${error}`
                : "Type to search"}
              {!loading && !requiresOrg && quickAdd ? (
                <div className="ml-2 inline-block">{quickAdd}</div>
              ) : null}
            </CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.name}
                  onSelect={() => {
                    onChange(it);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.id === it.id ? "opacity-100" : "opacity-0")} />
                  {it.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
