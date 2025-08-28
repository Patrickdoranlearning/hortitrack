"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client"; // Import your existing browser client

// Legacy \u2192 Supabase table mapping to keep old callsites working
const TABLE_MAP: Record<string, string> = {
  batches: "batches",
  varieties: "plant_varieties",
  sizes: "plant_sizes",
  locations: "nursery_locations", 
  suppliers: "suppliers",
  // add more aliases here if needed
};

type Options = {
  select?: string; // e.g. "*,plant_varieties(name)"
  orderBy?: { column: string; ascending?: boolean };
  filters?: Array<{ column: string; op?: "eq" | "ilike" | "gt" | "lt" | "gte" | "lte"; value: any }>;
  limit?: number;
  realtime?: boolean; // default true
};

export function useCollection<T = any>(
  tableOrAlias: string,
  initialData?: T[] | null,
  opts?: Options
) {
  const supabase = supabaseClient(); // Use your existing browser client
  const table = TABLE_MAP[tableOrAlias] ?? tableOrAlias;

  const [data, setData] = useState<T[] | null>(initialData ?? null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const fetchNow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query: any = supabase.from(table).select(optsRef.current?.select ?? "*");

      // Filters
      for (const f of optsRef.current?.filters ?? []) {
        const op = f.op ?? "eq";
        query = query[op](f.column as any, f.value);
      }

      // Order
      if (optsRef.current?.orderBy) {
        const { column, ascending = true } = optsRef.current.orderBy;
        query = query.order(column, { ascending });
      }

      if (optsRef.current?.limit) {
        query = query.limit(optsRef.current.limit);
      }

      const { data: supabaseData, error: supabaseError } = await query;
      if (supabaseError) throw supabaseError;
      setData((supabaseData as T[]) ?? []);
    } catch (e: any) {
      console.error(`useCollection(${table}) fetch error:`, e);
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [supabase, table]);

  // Initial fetch (if no initialData provided)
  useEffect(() => {
    if (!initialData) fetchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, initialData]);

  // Realtime subscription
  useEffect(() => {
    const enabled = optsRef.current?.realtime ?? true;
    if (!enabled) return;

    const channel = supabase
      .channel(`rt-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          // Re-fetch on any change
          fetchNow();
        }
      )
      .subscribe((status) => {
        // optional: console.log("realtime status", table, status)
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, table, fetchNow]);

  const forceRefresh = useCallback(async () => {
    await fetchNow();
  }, [fetchNow]);

  return { data, loading, error, forceRefresh };
}
