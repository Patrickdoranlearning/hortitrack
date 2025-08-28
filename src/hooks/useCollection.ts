"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client"; // CORRECT: Using your existing browser client
import type { Database } from "@/types/supabase";

const TABLE_MAP: Record<string, string> = {
  batches: "batches",
  varieties: "plant_varieties",
  sizes: "plant_sizes",
  locations: "nursery_locations", // Corrected from 'locations' to match schema
  suppliers: "suppliers",
};

type Options = {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Array<{ column: string; op?: "eq" | "ilike" | "gt" | "lt" | "gte" | "lte"; value: any }>;
  limit?: number;
  realtime?: boolean;
};

export function useCollection<T = any>(
  tableOrAlias: string,
  initialData?: T[] | null,
  opts?: Options
) {
  const supabase = supabaseClient(); // CORRECT: Using your existing browser client function
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

      for (const f of optsRef.current?.filters ?? []) {
        const op = f.op ?? "eq";
        query = query[op](f.column as any, f.value);
      }

      if (optsRef.current?.orderBy) {
        const { column, ascending = true } = optsRef.current.orderBy;
        query = query.order(column, { ascending });
      }

      if (optsRef.current?.limit) {
        query = query.limit(optsRef.current.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      setData((data as T[]) ?? []);
    } catch (e: any) {
      console.error(`useCollection(${table}) fetch error:`, e);
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [supabase, table]);

  useEffect(() => {
    if (!initialData) fetchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, initialData]);

  useEffect(() => {
    const enabled = optsRef.current?.realtime ?? true;
    if (!enabled) return;

    const channel = supabase
      .channel(`rt-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        fetchNow();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, table, fetchNow]);

  const forceRefresh = useCallback(() => fetchNow(), [fetchNow]);

  return { data, loading, error, forceRefresh };
}
