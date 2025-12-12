"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient, SupabaseClient } from "@/lib/supabase/client";

const orgScopedCollections = new Set(["nursery_locations", "suppliers"]);

// In-memory cache for lookup data (shared across all hook instances)
const cache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for lookup data

// Collections that rarely change and can be cached longer
const longCacheCollections = new Set([
  "plant_sizes",
  "plant_varieties",
  "nursery_locations",
  "suppliers",
  "attribute_options",
]);

function getCachedData<T>(key: string): T[] | null {
  const cached = cache.get(key);
  if (!cached) return null;

  const ttl = longCacheCollections.has(key) ? CACHE_TTL : 30_000; // 30s for other data
  if (Date.now() - cached.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return cached.data as T[];
}

function setCachedData(key: string, data: any[]) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function useCollection<T = any>(collectionName: string, initialData?: T[]) {
  // Check cache first for initial state
  const cachedInitial = useMemo(() => getCachedData<T>(collectionName), [collectionName]);

  const [data, setData] = useState<T[]>(initialData || cachedInitial || []);
  const [loading, setLoading] = useState(!initialData && !cachedInitial);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to create supabase client once per component instance
  const supabaseRef = useRef<SupabaseClient | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  useEffect(() => {
    let mounted = true;

    // If we have cached data, don't show loading state
    const cached = getCachedData<T>(collectionName);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

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
          const items = (json.items ?? json.data ?? []) as T[];
          if (mounted) {
            setData(items);
            setError(null);
            setCachedData(collectionName, items);
          }
        } else {
          const { data: result, error } = await supabase.from(collectionName).select("*");
          if (error) throw error;
          if (mounted) {
            setData(result as unknown as T[]);
            setError(null);
            setCachedData(collectionName, result as any[]);
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
    // Clear cache for this collection
    cache.delete(collectionName);

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
        const items = (json.items ?? json.data ?? []) as T[];
        setData(items);
        setCachedData(collectionName, items);
      } else {
        const { data: result, error } = await supabase.from(collectionName).select("*");
        if (error) throw error;
        setData(result as unknown as T[]);
        setCachedData(collectionName, result as any[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return { data, loading, error, forceRefresh };
}

// Export cache clearing function for use after mutations
export function invalidateCollection(collectionName: string) {
  cache.delete(collectionName);
}

export function invalidateAllCollections() {
  cache.clear();
}

async function getSessionToken(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
