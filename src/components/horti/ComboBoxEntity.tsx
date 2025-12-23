
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
type ColumnFilter = { column: string; op?: FilterOp; value: any };

export type ComboItem = { id: string; name: string; meta?: Record<string, any> };

type Props = {
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
} & Omit<React.ComponentProps<typeof Button>, "onChange"> & {
  value?: string | null;
  onChange?: (item: ComboItem | null) => void;
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
    setLoading(true);
    setError(null);
    try {
      let q = supabaseClient().from(table).select(select);

      if (orgScoped) {
        if (!orgId) {
          setItems([]);
          setError("NO_ORG");
          setLoading(false);
          return;
        }
        q = q.eq("org_id", orgId);
      }

      for (const f of filters) {
        const op = f.op ?? "eq";
        const column = f.column;
        const value = op === "ilike" ? String(f.value) : f.value;

        switch (op) {
          case "eq":
            q = q.eq(column, value);
            break;
          case "neq":
            q = q.neq(column, value);
            break;
          case "ilike":
            q = q.ilike(column, value);
            break;
          case "in":
            q = q.in(column, value);
            break;
          case "gte":
            q = q.gte(column, value);
            break;
          case "lte":
            q = q.lte(column, value);
            break;
        }
      }

      const by = orderBy ?? labelKey;
      if (by) q = q.order(by, { ascending: true });

      const key = searchKey ?? labelKey;
      if (term && key) q = q.ilike(key, `%${term}%`);

      const { data } = await q.limit(25).throwOnError();
      
      const rows = (data ?? []).map((r: any) =>
        r.multiple === undefined && r.cell_multiple !== undefined
          ? { ...r, multiple: r.cell_multiple }
          : r
      );
      setItems(rows.map(r => ({id: r[valueKey], name: r[labelKey], meta: r})));

    } catch (e: any) {
      const normalized =
        e && typeof e === "object"
          ? { code: e.code, message: e.message, details: e.details, hint: e.hint }
          : { message: String(e) };
      console.error(`[ComboBoxEntity] ${table} fetch failed`, normalized);
      setError(normalized.message || "Fetch failed");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [table, select, orgScoped, orgId, filters, orderBy, labelKey, searchKey, valueKey]);


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
                      props.onChange?.(it);
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
