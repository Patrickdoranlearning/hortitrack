
'use client';

import { useState, useEffect, useCallback, useContext } from 'react';
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";
import type { ReferenceData } from "@/lib/referenceData/service";

const GOLDEN_MAP: Record<string, keyof Omit<ReferenceData, "errors">> = {
  plant_varieties: "varieties",
  varieties: "varieties",
  plant_sizes: "sizes",
  sizes: "sizes",
  nursery_locations: "locations",
  locations: "locations",
  suppliers: "suppliers",
};

export function useCollection<T extends { id?: string }>(collectionName: string, initialData: T[] = []) {
  const ref = useContext(ReferenceDataContext);
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const lookupMap: Record<string, string> = {
      plant_varieties: "/api/lookups/varieties",
      varieties: "/api/lookups/varieties",
      plant_sizes: "/api/lookups/sizes",
      sizes: "/api/lookups/sizes",
      nursery_locations: "/api/lookups/locations",
      locations: "/api/lookups/locations",
      suppliers: "/api/lookups/suppliers",
    };
    const ctxKey = GOLDEN_MAP[collectionName];
    if (ctxKey && ref.data?.[ctxKey]) {
      setData(ref.data[ctxKey] as unknown as T[]);
      setLoading(false);
      return;
    }
    if (ctxKey && ref.loading) {
      setLoading(true);
      return;
    }

    const url = lookupMap[collectionName]
      ? lookupMap[collectionName]
      : `/api/collections/${collectionName}`;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const text = await res.text();
      let json: any = {};
      try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }

      if (res.status === 401) {
        // Not signed in: don't spam console; show gentle UI error
        setError("Sign in required");
        setData([]);
        return;
      }
      if (!res.ok) {
        const message = json?.error || res.statusText || `HTTP ${res.status}`;
        console.error(`useCollection(${collectionName}) fetch error:`, { message, url, status: res.status });
        setError(message);
        setData([]);
        return;
      }
      setData((json.items as T[]) ?? []);
    } catch (e: any) {
      const message = e?.message || String(e);
      console.error(`useCollection(${collectionName}) fetch error:`, { message, url });
      setError(message || "An unknown error occurred");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [collectionName, ref.data, ref.loading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const forceRefresh = useCallback(() => {
    const ctxKey = GOLDEN_MAP[collectionName];
    if (ctxKey) {
      ref.reload();
    } else {
      fetchData();
    }
  }, [collectionName, fetchData, ref]);

  return { data, loading, error, forceRefresh };
}
