
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Query, DocumentData } from 'firebase/firestore';
import { useAuth } from './use-auth';

// Define a generic type for the hook's return value
interface UseCollectionReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
}

// T is a generic type parameter for our document data
export function useCollection<T>(collectionPath: string, firestoreQuery?: Query): UseCollectionReturn<T> {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const subscribeToCollection = useCallback(() => {
    if (!user) {
      // Don't try to fetch if the user isn't logged in
      // You might want to adjust this based on your security rules
      setIsLoading(false);
      return () => {}; // Return an empty unsubscribe function
    }

    setIsLoading(true);
    
    // Use the provided query or default to the base collection
    const q = firestoreQuery || query(collection(db, collectionPath));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
        setData(documents);
        setIsLoading(false);
      },
      (err) => {
        console.error(`Error fetching collection ${collectionPath}:`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [collectionPath, firestoreQuery, user]);

  useEffect(() => {
    const unsubscribe = subscribeToCollection();
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [subscribeToCollection]);

  return { data, isLoading, error };
}
