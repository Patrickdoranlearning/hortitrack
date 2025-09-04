
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
  // Zero-fetch short-circuit: use in-memory context for golden tables
  const ctx = (() => {
    try { return useContext(ReferenceDataContext); } catch { return null; }
  })();
  if (ctx?.data) {
    if (resource === "locations") {
      return ctx.data.locations.map((l) => ({ value: l.name, label: `${l.nursery_site} · ${l.name}` }));
    }
    if (resource === "sizes") {
      return ctx.data.sizes.map((s) => ({ value: s.id, label: s.name }));
    }
    if (resource === "varieties") {
      return ctx.data.varieties.map((v) => ({ value: v.name, label: v.name }));
    }
    if (resource === "suppliers") {
      return ctx.data.suppliers.map((s) => ({ value: s.name, label: s.name }));
    }
  }
  const started = performance.now();
  const res = await fetch(url, { cache: "no-store", signal: controller.signal }).catch((err) => {
    console.error(`AsyncCombobox(${resource}) request failed`, { url, err });
    throw err;
  });
  clearTimeout(timeout);
  if (!res.ok) {
    console.warn(`AsyncCombobox(${resource}) HTTP ${res.status} ${res.statusText}`, { url });
    throw new Error(`Failed to fetch options: ${res.status} ${res.statusText}`);
  }
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
  resource: "varieties" | "sizes" | "suppliers" | "sites" | "locations";
  placeholder?: string;
  // Extra query params e.g. { siteId }
  params?: () => Record<string, string | undefined>;
  onSelected?: (opt: Option | null) => void;
};

export function AsyncCombobox({ name, control, resource, placeholder, params, onSelected }: Props) {
  const { field } = useController({ name, control });
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebounced(q);
  const [options, setOptions] = React.useState<Option[] | unknown>([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch on open and q change
  React.useEffect(() => {
    let abort = false;
    (async () => {
      if (!open) return;
      setLoading(true);
      try {
        const extra = params?.() ?? {};
        const queryParams = { q: debouncedQ, ...extra, limit: 20, debug: 1 };
        let data: Option[] = [];
        try {
          const url = new URL(`/api/options/${resource}`, window.location.origin);
          Object.entries(queryParams).forEach(([k,v]) => {
            if (v !== undefined) url.searchParams.set(k, String(v));
          });
          data = await fetchOptions(resource, url.toString(), new AbortController());
        } catch (err) {
          // API timed out or failed; fall through to fallback
        }
        if (Array.isArray(data) && data.length > 0) {
          if (!abort) setOptions(data);
        } else {
          // Fallback to direct Supabase (browser) to prove data path
          const started = performance.now();
          const fb = await fetchOptionsFallback(resource, queryParams);
          const dur = Math.round(performance.now() - started);
          console.info(`AsyncCombobox(${resource}) fallback`, { size: fb.length, durMs: dur });
          if (!abort) setOptions(fb);
        }
      } catch (e) {
        if (!abort) setOptions([]);
        console.error(`AsyncCombobox(${resource}) fetch failed`, e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [open, debouncedQ, resource, params]);

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
