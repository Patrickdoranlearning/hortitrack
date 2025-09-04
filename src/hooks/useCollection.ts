
'use client';

import { useState, useEffect, useCallback, useContext } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { ReferenceDataContext } from "@/contexts/ReferenceDataContext";

const GOLDEN = new Set(["nursery_locations", "plant_sizes", "plant_varieties", "suppliers"]);

export function useCollection<T extends { id?: string }>(collectionName: string, initialData: T[] = []) {
  const ref = useContext(ReferenceDataContext);
  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = supabaseClient();

  const fetchData = useCallback(async () => {
     // Short-circuit golden tables to in-memory context (no HTTP, no RLS)
    if (GOLDEN.has(collectionName) && ref.data) {
      try {
        if (collectionName === "nursery_locations") {
          setData(ref.data.locations as unknown as T[]);
          setLoading(false);
          return;
        }
        if (collectionName === "plant_sizes") {
          setData(ref.data.sizes as unknown as T[]);
          setLoading(false);
          return;
        }
        if (collectionName === "plant_varieties") {
          setData(ref.data.varieties as unknown as T[]);
          setLoading(false);
          return;
        }
        if (collectionName === "suppliers") {
          setData(ref.data.suppliers as unknown as T[]);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error(`useCollection(${collectionName}) context error:`, e);
      }
    }
    setLoading(true);
    setError(null);
    try {
      const { data: supabaseData, error: supabaseError } = await supabase
        .from(collectionName)
        .select('*')
        .order('createdAt', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }
      
      // Ensure data has an 'id' property if it's missing, though Supabase usually provides it.
      const itemsWithIds = (supabaseData as T[]).map(item => ({
        ...item,
        id: item.id || (item as any)._id, // Fallback if 'id' is not directly present, e.g., if it was '_id' in Firestore
      }));

      setData(itemsWithIds);
    } catch (err: any) {
      console.error(`Failed to fetch collection ${collectionName}:`, err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [collectionName, supabase, ref.data]);

  useEffect(() => {
    fetchData();

    // Supabase real-time subscriptions can be added here if needed
    // For simplicity, we're just doing a one-time fetch on mount/refresh.
    // If you need real-time updates, you would implement the subscribe method:
    // const channel = supabase.channel(`${collectionName}_changes`);
    // channel.on(
    //   'postgres_changes',
    //   { event: '*', schema: 'public', table: collectionName },
    //   (payload) => {
    //     console.log('Change received!', payload);
    //     fetchData(); // Re-fetch on change, or implement more granular updates
    //   }
    // ).subscribe();

    // return () => {
    //   channel.unsubscribe();
    // };
  }, [fetchData]);

  const forceRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, forceRefresh };
}
