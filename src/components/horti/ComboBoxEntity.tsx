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
import { supabaseClient } from "@/lib/supabase/client"; // Use the browser-safe client
import { useActiveOrg } from "@/server/org/context";

type Entity = "varieties" | "sizes" | "locations" | "suppliers";

export type ComboItem = { id: string; name: string; meta?: Record<string, any> };

type Props = {
  entity: Entity;
  orgScoped?: boolean; // NEW: defaults true
  trayOnly?: boolean;
  value: ComboItem | null;
  onChange: (item: ComboItem | null) => void;
  placeholder?: string;
  quickAdd?: React.ReactNode;
  loadOnOpen?: boolean;
  label?: string; // Add label for accessibility and context
};

const SEARCH_META_MAP: Record<Entity, { table: string; select: string; }> = {
    varieties: { table: 'plant_varieties', select: 'id, name, family, genus, species, category' },
    sizes: { table: 'plant_sizes', select: 'id,name,container_type,multiple:cell_multiple' },
    locations: { table: 'nursery_locations', select: 'id, name' },
    suppliers: { table: 'suppliers', select: 'id, name, country_code' },
}

export function ComboBoxEntity({
  entity,
  orgScoped = true, // Default to true for backward compatibility
  trayOnly,
  value,
  onChange,
  placeholder = "Search…",
  quickAdd,
  loadOnOpen = true,
  label,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ComboItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ctrlRef = React.useRef<AbortController | null>(null);
  const mounted = React.useRef(true);
  const orgId = useActiveOrg();

  React.useEffect(
    () => () => {
      mounted.current = false;
      ctrlRef.current?.abort();
    },
    []
  );

  const fetchItems = React.useCallback(async () => {
    setError(null);
    if (orgScoped && !orgId) {
      setItems([]);
      return;
    }
    setLoading(true);
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;

    try {
        const supabase = supabaseClient();
        const meta = SEARCH_META_MAP[entity];
        let query = supabase.from(meta.table).select(meta.select);
        
        if (orgScoped && orgId) {
            query = query.eq('org_id', orgId);
        }

        if (q) {
            query = query.ilike('name', `%${q}%`);
        }

        if (trayOnly) {
            query = query.ilike('container_type', 'Tray');
        }

        query = query.order('name').limit(25);

        const { data, error } = await query;
        if (error) throw error;

        if (!controller.signal.aborted) {
            setItems(data.map(r => ({id: r.id, name: r.name, meta: r})));
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
  }, [q, entity, orgId, orgScoped, trayOnly]);

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

  const requiresOrg = orgScoped && !orgId;

  return (
    <div className="space-y-1">
    {label && <Label>{label}</Label>}
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loading || requiresOrg}>
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
              {requiresOrg
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
    </div>
  );
}