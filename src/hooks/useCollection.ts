// src/hooks/useCollection.ts
"use client";

import * as React from "react";

export type Params = {
  q?: string;
  site?: string;   // for nursery_locations filter (denormalized site name)
  limit?: number;
};

export type UseCollectionResult<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

// Canonicalize common aliases used around the codebase
function canonicalize(table: string): string {
  const t = table.toLowerCase();
  if (t === "locations") return "nursery_locations";
  return t;
}

function buildUrl(table: string, params: Params): string {
  const canonical = canonicalize(table);
  const url = new URL(
    `/api/collections/${encodeURIComponent(canonical)}`,
    typeof window === "undefined" ? "http://localhost" : window.location.origin
  );
  if (params.q) url.searchParams.set("q", params.q);
  if (params.site) url.searchParams.set("site", params.site);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  // return relative path + query so Next fetch hits the same origin
  return url.pathname + (url.search || "");
}

/**
 * Generic collection fetcher. Returns raw rows from /api/collections/[table].
 * RLS is enforced server-side (via Supabase + cookies).
 */
export function useCollection<T = any>(
  table: string,
  params: Params = {}
): UseCollectionResult<T> {
  const [data, setData] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const url = React.useMemo(() => buildUrl(table, params), [table, params.q, params.site, params.limit]);

  const fetchNow = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    try {
      const res = await fetch(url, { credentials: "include", signal: controller.signal });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore parse errors; will synthesize a message below if needed
      }

      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `HTTP ${res.status}${res.statusText ? " " + res.statusText : ""}`;
        const err = new Error(msg);
        (err as any).status = res.status;
        (err as any).details = json ?? null;
        throw err;
      }

      const rows: T[] = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
      setData(rows);
    } catch (e: any) {
      console.error(`useCollection(${table}) fetch error:`, {
        message: e?.message || String(e),
        status: e?.status,
        details: e?.details,
      });
      setData([]);
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [table, url]);

  React.useEffect(() => {
    const cleanup = (fetchNow() as unknown) as void | (() => void);
    return typeof cleanup === "function" ? cleanup : undefined;
  }, [fetchNow]);

  return { data, loading, error, refetch: fetchNow };
}