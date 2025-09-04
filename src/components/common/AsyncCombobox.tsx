
"use client";
import * as React from "react";
import { useController, Control } from "react-hook-form";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useContext, useMemo } from "react";
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";

type Option = { id: string; label: string; [k: string]: any };

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export async function fetchOptions(resource: string, url: string, controller: AbortController) {
  const started = performance.now();
  const res = await fetch(url, { cache: "no-store", signal: controller.signal }).catch((err) => {
    console.error(`AsyncCombobox(${resource}) request failed`, { url, err });
    throw err;
  });
  const timeout = setTimeout(() => controller.abort(), 3000);
  if (!res.ok) {
    console.warn(`AsyncCombobox(${resource}) HTTP ${res.status} ${res.statusText}`, { url });
    throw new Error(`Failed to fetch options: ${res.status} ${res.statusText}`);
  }
  clearTimeout(timeout);
  const count = res.headers.get("X-Horti-Count");
  const timedOut = res.headers.get("X-Horti-Timeout") === "1";
  const dur = Math.round(performance.now() - started);
  console.info(`AsyncCombobox(${resource})`, { url, count, durMs: dur, timedOut });
  const json = await res.json().catch(() => ([]));
  // If the API ever returns an object (e.g., {error:...}) or HTML, normalize to []
  return Array.isArray(json) ? (json as Option[]) : [];
}

/**
 * Direct browser fallback to Supabase when the API returns [] or times out.
 * This isolates whether the problem is the route vs. data/RLS.
 */
async function fetchOptionsFallback(resource: string, params: Record<string, any>): Promise<Option[]> {
  const supabase = getSupabaseBrowser();
  const limit = Number(params.limit ?? 20);
  const q: string = (params.q ?? "").trim();
  const siteId = params.siteId as string | undefined;

  if (resource === "varieties") {
    let qb = supabase.from("plant_varieties").select("id,name,family,genus,species").order("name").limit(limit);
    if (q) qb = qb.or(`name.ilike.%${q}%,genus.ilike.%${q}%,species.ilike.%${q}%`);
    const { data, error } = await qb;
    if (error) { console.warn("[fallback] varieties", error); return []; }
    return (data ?? []).map(v => ({ id: v.id, label: v.name, meta: v.family ?? v.genus ?? v.species ?? null }));
  }

  if (resource === "sizes") {
    let qb = supabase.from("plant_sizes").select("id,name,container_type,cell_multiple").order("name").limit(limit);
    if (q) qb = qb.ilike("name", `%${q}%`);
    const { data, error } = await qb;
    if (error) { console.warn("[fallback] sizes", error); return []; }
    return (data ?? []).map(s => ({ id: s.id, label: s.name, meta: s.container_type, multiple: s.cell_multiple }));
  }

  if (resource === "sites") {
    let qb = supabase.from("sites").select("id,name").order("name").limit(limit);
    if (q) qb = qb.ilike("name", `%${q}%`);
    const { data, error } = await qb;
    if (error) { console.warn("[fallback] sites", error); return []; }
    return (data ?? []).map(s => ({ id: s.id, label: s.name }));
  }

  if (resource === "locations") {
    let qb = supabase.from("nursery_locations").select("id,name,site_id").order("name").limit(limit);
    if (siteId) qb = qb.eq("site_id", siteId);
    if (q) qb = qb.ilike("name", `%${q}%`);
    const { data, error } = await qb;
    if (error) { console.warn("[fallback] locations", error); return []; }
    return (data ?? []).map(l => ({ id: l.id, label: l.name, siteId: l.site_id }));
  }

  return [];
}

type Props = {
  name: string;
  control: Control<any>;
  resource: "varieties" | "sizes" | "suppliers" | "sites" | "locations" | string;
  url?: string;
  placeholder?: string;
  // Extra query params e.g. { siteId }
  params?: () => Record<string, string | undefined>;
  onSelected?: (opt: Option | null) => void;
};

export function AsyncCombobox({ name, control, resource, url, placeholder, params, onSelected }: Props) {
  const ref = useContext(ReferenceDataContext);
  const { field } = useController({ name, control });
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebounced(q);
  const [options, setOptions] = React.useState<Option[] | unknown>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch on open and q change
  React.useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        // Golden tables: use context directly, skip network
        if (ref.data && ["locations", "sizes", "varieties", "suppliers"].includes(resource)) {
          const o =
            resource === "locations"
              ? ref.data.locations.map((l) => ({ value: l.name, label: `${l.nursery_site} · ${l.name}`, ...l }))
              : resource === "sizes"
              ? ref.data.sizes.map((s) => ({ value: s.id, label: s.name, ...s }))
              : resource === "varieties"
              ? ref.data.varieties.map((v) => ({ value: v.name, label: v.name, ...v }))
              : ref.data.suppliers.map((s) => ({ value: s.name, label: s.name, ...s }));
          if (!abort) setOptions(o as any);
        } else if (url) {
          const controller = new AbortController();
          const opts = await fetchOptions(resource, url, controller);
          if (!abort) setOptions(opts);
        } else {
          if (!abort) setOptions([]);
        }
      } catch (e) {
        if (!abort) setError(e as Error);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [resource, url, ref.data, debouncedQ]);


  // Normalize runtime values to avoid ".find is not a function"
  const list: Option[] = Array.isArray(options) ? (options as Option[]) : [];
  const fieldValue = typeof field.value === "string" ? field.value : field.value?.id;
  const selected = list.find(o => o.id === fieldValue) ?? null;

  // Dev visibility: how many options are actually renderable right now
  if (process.env.NODE_ENV !== "production" && open) {
    console.info(`AsyncCombobox(${resource}) render list length`, list.length);
    if (list.length > 0) console.debug(`AsyncCombobox(${resource}) first`, list[0]);
  }


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          {selected ? selected.label : (placeholder ?? "Select...")}
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
                key={opt.id}
                onSelect={() => {
                  field.onChange(opt.id);
                  setOpen(false);
                  setQ("");
                  onSelected?.(opt);
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
