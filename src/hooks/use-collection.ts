
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, onSnapshot, query, QueryConstraint, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

export type UseCollectionResult<T> = {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  forceRefresh: () => void;
};

/**
 * Subscribe to a Firestore collection and keep it in React state.
 *
 * @param collectionName Firestore collection path (e.g., "batches")
 * @param initialData Optional initial data for SSR hydration
 * @param constraints Optional Firestore query constraints
 */
export function useCollection<T extends DocumentData = DocumentData>(
  collectionName: string,
  initialData?: T[],
  constraints: QueryConstraint[] = []
): UseCollectionResult<T> {
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<T[]>(initialData ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const unsubRef = useRef<null | (() => void)>(null);

  const forceRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const subscribe = useCallback(() => {
    // If not authenticated, rely on initialData and do not subscribe
    if (!user) {
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);
    setError(null);

    const base = collection(db, collectionName);
    const q = constraints.length ? query(base, ...constraints) : query(base);

    if (unsubRef.current) {
      try { unsubRef.current(); } catch {}
      unsubRef.current = null;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: T[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
        setData(next);
        setIsLoading(false);
      },
      (err) => {
        console.error(`[useCollection:${collectionName}] onSnapshot error`, err);
        setError(err);
        setIsLoading(false);
        toast({
          title: "Failed to load data",
          description: `We couldn't fetch ${collectionName}.`,
          variant: "destructive",
        });
      }
    );

    unsubRef.current = unsubscribe;
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, user, toast, JSON.stringify(constraints), refreshKey]);

  useEffect(() => {
    const unsub = subscribe();
    return () => { if (unsub) unsub(); };
  }, [subscribe]);

  return {
    data: Array.isArray(data) ? data : [],
    isLoading,
    error,
    forceRefresh,
  };
}
