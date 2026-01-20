'use client';
import useSWR from 'swr';
import { supabaseClient } from '@/lib/supabase/client';

const supabase = supabaseClient();

type Row = { id: string; name: string };
type SizeRow = Row & { container_type?: string | null; cell_multiple?: number | null };
type VarietyRow = { id: string; name: string; family: string | null; genus: string | null; species: string | null };
type SupplierRow = { id: string; name: string; producer_code: string | null; country_code: string | null };

async function fetchVarieties(): Promise<VarietyRow[]> {
  const r = await supabase.from('plant_varieties')
    .select('id,name,family,genus,species')
    .order('name', { ascending: true });
  if (r.error) throw r.error;
  return r.data as VarietyRow[];
}

async function fetchSizes(): Promise<SizeRow[]> {
  const r = await supabase.from('plant_sizes')
    .select('id,name,container_type,cell_multiple')
    .order('name', { ascending: true });
  if (r.error) throw r.error;
  return r.data as SizeRow[];
}

async function fetchLocations(orgId?: string): Promise<Row[]> {
  const r = await supabase.from('nursery_locations')
    .select('id,name')
    .match(orgId ? { org_id: orgId } : {})
    .order('name', { ascending: true });
  if (r.error) throw r.error;
  return r.data as Row[];
}

async function fetchSuppliers(orgId?: string): Promise<SupplierRow[]> {
  const r = await supabase.from('suppliers')
    .select('id,name,producer_code,country_code')
    .match(orgId ? { org_id: orgId } : {})
    .order('name', { ascending: true });
  if (r.error) throw r.error;
  return r.data as SupplierRow[];
}

export function useCatalog(orgId?: string) {
  const varieties = useSWR<VarietyRow[]>('varieties', fetchVarieties);
  const sizes = useSWR<SizeRow[]>('sizes', fetchSizes);
  const locations = useSWR<Row[]>(orgId ? ['locations', orgId] : null, () => fetchLocations(orgId));
  const suppliers = useSWR<SupplierRow[]>(orgId ? ['suppliers', orgId] : null, () => fetchSuppliers(orgId));

  return { varieties, sizes, locations, suppliers };
}
