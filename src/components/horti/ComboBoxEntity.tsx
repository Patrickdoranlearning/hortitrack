"use client";
import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Entity = "varieties" | "sizes" | "locations" | "suppliers";

export type ComboItem = { id: string; name: string; meta?: Record<string, any> };

type Props = {
  entity: Entity;
  orgId?: string | null;             // required for locations & suppliers, ignored for varieties/sizes
  trayOnly?: boolean;                // sizes only
  value: ComboItem | null;
  onChange: (item: ComboItem | null) => void;
  placeholder?: string;
  quickAdd?: React.ReactNode;
  loadOnOpen?: boolean;              // default true
};

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
  React.useEffect(() => () => { mounted.current = false; ctrlRef.current?.abort(); }, []);

  const requiresOrg = entity === "locations" || entity === "suppliers";

  async function fetchItems(signal: AbortSignal) {
    setError(null);
    // Early guard: if org is required but missing, show hint and bail fast
    if (requiresOrg && !orgId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const url = new URL(`/api/search/${entity}`, window.location.origin);
      if (q) url.searchParams.set("q", q);
      if (requiresOrg && orgId) url.searchParams.set("orgId", orgId);
      if (entity === "sizes" && trayOnly) url.searchParams.set("trayOnly", "1");

      const res = await fetch(url.toString(), { signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[ComboBoxEntity] ${entity} ${res.status}`, body.slice(0, 140));
        setItems([]);
        setError("Search failed");
        return;
      }

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const body = await res.text().catch(() => "");
        console.warn(`[ComboBoxEntity] ${entity} non-JSON`, body.slice(0, 140));
        setItems([]);
        setError("Bad response");
        return;
      }

      const payload = (await res.json().catch(() => ({ items: [] }))) as { items?: ComboItem[]; error?: string };
      setItems(Array.isArray(payload.items) ? payload.items : []);
      if (payload.error) setError(payload.error);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.warn(`[ComboBoxEntity] ${entity} error`, e);
        setError("Network error");
        setItems([]);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  // Debounced search
  React.useEffect(() => {
    if (!open) return;
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;
    const t = setTimeout(() => fetchItems(controller.signal), 250);
    return () => { clearTimeout(t); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, entity, orgId, trayOnly]);

  // First open → optionally load with empty q
  React.useEffect(() => {
    if (!open || !loadOnOpen) return;
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;
    fetchItems(controller.signal);
    // only run when open toggles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          {value ? value.name : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[400px]">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={q}
            onValueChange={(v) => setQ(v)}
          />
          <CommandList>
            <CommandEmpty>
              {requiresOrg && !orgId
                ? "Select an organization first"
                : loading
                  ? "Searching…"
                  : q
                    ? (error ? `No results • ${error}` : "No results.")
                    : (error ? `Error • ${error}` : "Type to search")}
              {(!loading && !requiresOrg && quickAdd) ? <div className="ml-2 inline-block">{quickAdd}</div> : null}
            </CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.name}
                  onSelect={() => { onChange(it); setOpen(false); }}
                >
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
