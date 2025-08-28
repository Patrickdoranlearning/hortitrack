
// Browser-safe reference data queries used by client components.
// No server-only imports here.
"use client";

import { supabaseClient } from "@/lib/supabase/client";

/** Varieties */
export async function searchVarieties(q: string, orgId?: string) {
  const supabase = supabaseClient();
  let query = supabase.from("plant_varieties").select("id,name,family").order("name");
  if (orgId) query = query.eq("org_id", orgId);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query.limit(25);
  if (error) throw error;
  return data ?? [];
}

/** Sizes */
export async function searchSizes(q: string, orgId?: string) {
  const supabase = supabaseClient();
  let query = supabase.from("plant_sizes").select("id,name,multiple,container_type").order("name");
  if (orgId) query = query.eq("org_id", orgId);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query.limit(25);
  if (error) throw error;
  return data ?? [];
}

/** Locations (fallback if your table is named differently) */
export async function searchLocations(q: string, orgId?: string) {
  const supabase = supabaseClient();
  // Try 'locations' first
  let query = supabase.from("nursery_locations").select("id,name").order("name");
  if (orgId) query = query.eq("org_id", orgId);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  let { data, error } = await query.limit(50);

  if (error) throw error;
  return data ?? [];
}

/** Suppliers */
export async function searchSuppliers(q: string, orgId?: string) {
  const supabase = supabaseClient();
  let query = supabase.from("suppliers").select("id,name,country_code,producerCode").order("name");
  if (orgId) query = query.eq("org_id", orgId);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query.limit(50);
  if (error) throw error;
  return data ?? [];
}
