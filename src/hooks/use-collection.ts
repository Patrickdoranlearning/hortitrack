
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Query, DocumentData, QueryConstraint, writeBatch, doc } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

interface UseCollectionReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  forceRefresh: () => void;
}

export function useCollection<T>(
  collectionName: string,
  initialData: any[] = [],
  constraints: QueryConstraint[] = [],
): UseCollectionReturn<T> {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<T[]>(initialData as T[]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const forceRefresh = () => {
    setRefreshKey(oldKey => oldKey + 1);
  };

  const subscribeToCollection = useCallback(() => {
    if (!user) {
      setData(initialData as T[]);
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);
    
    const q = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty && initialData.length > 0) {
            if (!user) { setIsLoading(false); return; }
            console.log(`Collection '${collectionName}' is empty. Seeding initial data.`);
            const batch = writeBatch(db);
            initialData.forEach(item => {
              const { id, ...data } = item;
              const docRef = doc(collection(db, collectionName));
              batch.set(docRef, data);
            });
            batch.commit()
              .then(() => console.log(`Initial data for '${collectionName}' seeded successfully.`))
              .catch(err => console.error(`Failed to seed data for ${collectionName}:`, err));
        } else {
            const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
            setData(documents);
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, user, toast, JSON.stringify(constraints), refreshKey]);

  useEffect(() => {
    const unsubscribe = subscribeToCollection();
    return () => unsubscribe();
  }, [subscribeToCollection]);

  return { data: data || initialData || [], isLoading, error, forceRefresh };
}

    