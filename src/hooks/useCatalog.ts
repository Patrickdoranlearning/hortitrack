'use client';
import useSWR from 'swr';
import { supabase } from '@/lib/supabaseClient';

type Row = { id: string; name: string };
type SizeRow = Row & { container_type?: string | null; cell_multiple?: number | null };

async function fetcher<T>(key: string, q: () => Promise<T>): Promise<T> { return q(); }

export function useCatalog(orgId?: string) {
  const varieties = useSWR(['varieties'], () =>
    supabase.from('plant_varieties')
      .select('id,name,family,genus,species')
      .order('name', { ascending: true })
      .then(r => { if (r.error) throw r.error; return r.data; })
  );

  const sizes = useSWR(['sizes'], () =>
    supabase.from('plant_sizes')
      .select('id,name,container_type,cell_multiple')
      .order('name', { ascending: true })
      .then(r => { if (r.error) throw r.error; return r.data as SizeRow[]; })
  );

  const locations = useSWR(['locations', orgId], () =>
    supabase.from('nursery_locations')
      .select('id,name')
      .match(orgId ? { org_id: orgId } : {})
      .order('name', { ascending: true })
      .then(r => { if (r.error) throw r.error; return r.data as Row[]; })
  );

  const suppliers = useSWR(['suppliers', orgId], () =>
    supabase.from('suppliers')
      .select('id,name,producer_code,country_code')
      .match(orgId ? { org_id: orgId } : {})
      .order('name', { ascending: true })
      .then(r => { if (r.error) throw r.error; return r.data; })
  );

  return { varieties, sizes, locations, suppliers };
}
