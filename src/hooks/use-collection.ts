
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Query, DocumentData, QueryConstraint } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

interface UseCollectionReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
}

export function useCollection<T>(
  collectionName: string,
  initialData: T[] = [],
  constraints: QueryConstraint[] = [],
): UseCollectionReturn<T> {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<T[]>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const subscribeToCollection = useCallback(() => {
    if (!user) {
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);
    
    const q = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
        setData(documents);
        setIsLoading(false);
      },
      (err) => {
        console.error(`Error fetching collection ${collectionName}:`, err);
        setError(err);
        setIsLoading(false);
        toast({
            variant: 'destructive',
            title: `Error loading ${collectionName}`,
            description: err.message,
        });
      }
    );

    return unsubscribe;
  }, [collectionName, user, toast, constraints]);

  useEffect(() => {
    const unsubscribe = subscribeToCollection();
    return () => unsubscribe();
  }, [subscribeToCollection]);

  return { data, isLoading, error };
}
