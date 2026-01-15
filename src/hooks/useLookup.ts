// src/hooks/useLookup.ts
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";

type LookupResource = "varieties" | "sizes" | "locations" | "suppliers";
type Option = { id: string; name: string } & Record<string, any>;

const VERSION = 1; // bump to invalidate old local cache

function key(resource: LookupResource, orgId?: string | null) {
  return orgId ? `/api/lookups/${resource}?org=${orgId}` : `/api/lookups/${resource}`;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

function readCache(resource: LookupResource, orgId?: string | null): Option[] | null {
  try {
    const raw = localStorage.getItem(`lookup:${VERSION}:${resource}:${orgId ?? "global"}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(resource: LookupResource, orgId: string | null | undefined, options: Option[]) {
  try {
    localStorage.setItem(
      `lookup:${VERSION}:${resource}:${orgId ?? "global"}`,
      JSON.stringify(options)
    );
  } catch {}
}

/**
 * Loads once, returns instantly from localStorage if present,
 * refreshes in background via SWR, and "learns" new items you pass in.
 */
export function useLookup(resource: LookupResource, orgId?: string | null) {
  const [cached, setCached] = useState<Option[] | null>(null);
  const bootstrapDone = useRef(false);

  // Bootstrap from localStorage immediately
  useEffect(() => {
    if (bootstrapDone.current) return;
    const c = readCache(resource, orgId);
    if (c) setCached(c);
    bootstrapDone.current = true;
     
  }, [resource, orgId]);

  // SWR fetch (deduped, background)
  const { data, error, isLoading, mutate } = useSWR(key(resource, orgId), fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  });

  // Normalize { data } shape from API
  const options: Option[] = useMemo(() => {
    const rows: Option[] = data?.data ?? [];
    if (rows?.length) writeCache(resource, orgId, rows);
    return rows?.length ? rows : (cached ?? []);
  }, [data, cached, resource, orgId]);

  // “Save-as-you-search” / merge helper (call this when you learn a new option)
  const merge = (incoming: Option | Option[]) => {
    const arr = Array.isArray(incoming) ? incoming : [incoming];
    const byId = new Map(options.map(o => [o.id, o]));
    arr.forEach(o => byId.set(o.id, o));
    const merged = Array.from(byId.values());
    writeCache(resource, orgId, merged);
    setCached(merged);
    mutate({ data: merged }, { revalidate: false });
  };

  // Client-side fuzzy filter (simple contains)
  const search = (q: string, limit = 50) => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, limit);
    return options.filter(o => String(o.name).toLowerCase().includes(s)).slice(0, limit);
  };

  return { options, search, error, isLoading: isLoading && !cached, merge, mutate };
}
