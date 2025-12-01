"use client";

import { useEffect, useState } from "react";
import { createClient, SupabaseClient } from "@/lib/supabase/client";

const orgScopedCollections = new Set(["nursery_locations", "suppliers"]);

export function useCollection<T = any>(collectionName: string, initialData?: T[]) {
    const [data, setData] = useState<T[]>(initialData || []);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<Error | null>(null);

    const supabase = createClient();

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
        if (orgScopedCollections.has(collectionName)) {
          const url =
            collectionName === "suppliers"
              ? "/api/lookups/suppliers"
              : "/api/lookups/locations";
          const token = await getSessionToken(supabase);
          const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (!res.ok) throw new Error(await res.text());
          const json = await res.json();
          if (mounted) {
            setData((json.items ?? json.data ?? []) as T[]);
            setError(null);
          }
        } else {
          const { data: result, error } = await supabase.from(collectionName).select("*");
                if (error) throw error;
                if (mounted) {
                    setData(result as unknown as T[]);
                    setError(null);
          }
                }
            } catch (err: any) {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            mounted = false;
        };
  }, [collectionName, supabase]);

    const forceRefresh = async () => {
    try {
      if (orgScopedCollections.has(collectionName)) {
        const url =
          collectionName === "suppliers"
            ? "/api/lookups/suppliers"
            : "/api/lookups/locations";
        const token = await getSessionToken(supabase);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData((json.items ?? json.data ?? []) as T[]);
      } else {
        const { data: result, error } = await supabase.from(collectionName).select("*");
        if (error) throw error;
            setData(result as unknown as T[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
        }
    };

    return { data, loading, error, forceRefresh };
}

async function getSessionToken(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
