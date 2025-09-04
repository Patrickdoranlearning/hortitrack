import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
 
 export function useCollection<T = any>(table: string) {
   const [data, setData] = useState<T[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   const fetchNow = useCallback(async () => {
     setLoading(true);
     setError(null);
     try {
       const res = await fetchWithAuth(`/api/collections/${table}`);
       const ct = res.headers.get('content-type') || '';
       if (!ct.includes('application/json')) {
         // Next returned HTML (route missing or server crashed)
         const text = await res.text();
         throw {
           message: 'Non-JSON response',
           status: res.status,
           details: text.slice(0, 200),
         };
       }
 
       if (!res.ok) {
         const body = await res.json().catch(() => ({}));
         throw {
           message: body?.error || `HTTP ${res.status} ${res.statusText}`,
           status: res.status,
           details: null,
         };
       }
 
       const { rows } = await res.json();
       const rowsTyped = (rows ?? []) as T[];
       setData(rowsTyped);
     } catch (e: any) {
       console.error(`useCollection(${table}) fetch error:`, {
         message: e?.message || String(e),
         status: e?.status,
         details: e?.details,
       });
       setError(e?.message || 'Failed to load');
     } finally {
       setLoading(false);
     }
   }, [table]);
 
   useEffect(() => {
     fetchNow();
   }, [fetchNow]);
 
   return { data, loading, error, refetch: fetchNow };
 }
