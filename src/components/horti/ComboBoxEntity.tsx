
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
import { supabaseClient } from "@/lib/supabase/client";
import { useActiveOrg } from "@/lib/org/context";
import { Label } from "@/components/ui/label";

type FilterOp = "eq" | "ilike" | "in" | "neq" | "gte" | "lte";
type ColumnFilter = { column: string; op?: FilterOp; value: string | number | boolean };

export type ComboItem = { id: string; name: string; meta?: Record<string, any> };

type Props = {
  entity: "varieties" | "sizes" | "locations" | "suppliers";
  table: string;
  select: string;
  labelKey?: string;
  valueKey?: string;
  searchKey?: string;
  orderBy?: string;
  orgScoped?: boolean;
  label?: React.ReactNode;
  filters?: ColumnFilter[];
  placeholder?: string;
  quickAdd?: React.ReactNode;
  loadOnOpen?: boolean;
} & Omit<React.ComponentProps<typeof Button>, "onSelect"> & {
  value?: string | null;
  onSelect?: (id: string | null, row?: any) => void;
};


export function ComboBoxEntity(props: Props) {
  const {
    table,
    select,
    labelKey = "name",
    valueKey = "id",
    searchKey,
    orderBy,
    orgScoped = true,
    label,
    filters = [],
    placeholder = "Search…",
    quickAdd,
    loadOnOpen = true,
    ...buttonProps
  } = props;
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<ComboItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ctrlRef = React.useRef<AbortController | null>(null);
  const mounted = React.useRef(true);
  const { orgId } = useActiveOrg();

  React.useEffect(
    () => () => {
      mounted.current = false;
      ctrlRef.current?.abort();
    },
    []
  );

  const fetchItems = React.useCallback(async (term?: string) => {
    setError(null);
    if (orgScoped && !orgId) {
      setItems([]);
      setError("NO_ORG");
      return;
    }
    setLoading(true);
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;

    try {
      const supabase = supabaseClient();
      let query = supabase.from(table).select(select);

      if (orgScoped && orgId) {
        query = query.eq("org_id", orgId);
      }
      
      for (const f of filters) {
        const op = f.op ?? "eq";
        // @ts-expect-error op is a keyof the query builder
        query = query[op](f.column as any, op === "ilike" ? `%${String(f.value)}%` : f.value);
      }

      if (term) {
        const key = searchKey ?? labelKey;
        query = query.ilike(key, `%${term}%`);
      }

      if (orderBy) {
        query = query.order(orderBy, { ascending: true });
      }

      query = query.limit(25);

      const { data, error } = await query;
      if (error) throw error;
      
      if (!controller.signal.aborted) {
        const rows = (data ?? []).map((r: any) =>
          r.multiple === undefined && r.cell_multiple !== undefined
            ? { ...r, multiple: r.cell_multiple }
            : r
        );
        setItems(rows.map(r => ({id: r[valueKey], name: r[labelKey], meta: r})));
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(`[ComboBoxEntity] ${table} fetch failed`, {
          code: e?.code, message: e?.message, details: e?.details, hint: e?.hint
        });
        setError(e.message || "Network error");
        setItems([]);
      }
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }, [q, table, select, labelKey, valueKey, searchKey, orderBy, orgId, orgScoped, filters]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchItems(q), q ? 250 : 0); // fetch immediately if no search term
    return () => clearTimeout(t);
  }, [q, open, fetchItems]);

  const selectedItem = items.find(it => it.id === props.value);

  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loading || (orgScoped && !orgId)} {...buttonProps}>
            {selectedItem ? selectedItem.name : placeholder}
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
                {loading
                  ? "Searching…"
                  : error === "NO_ORG"
                  ? "Select an organization first."
                  : error ? `Error: ${error}` : "No results."
                }
                {!loading && quickAdd ? (
                  <div className="ml-2 inline-block">{quickAdd}</div>
                ) : null}
              </CommandEmpty>
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.name}
                    onSelect={() => {
                      props.onSelect?.(it.id, it.meta);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", props.value === it.id ? "opacity-100" : "opacity-0")} />
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
