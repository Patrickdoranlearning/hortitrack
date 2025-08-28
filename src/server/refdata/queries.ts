
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
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Sizes (fallback if 'category' column doesn't exist) */
export async function searchSizes(q: string, orgId?: string) {
  const supabase = supabaseClient();
  let query = supabase.from("plant_sizes").select("id,name,multiple,container_type").order("name");
  if (orgId) query = query.eq("org_id", orgId);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  let { data, error } = await query.limit(25);
  if (error && /column.*category/i.test(error.message ?? "")) {
    const res2 = await supabase.from("plant_sizes").select("id,name,multiple").order("name").limit(25);
    if (res2.error) throw new Error(res2.error.message);
    return res2.data ?? [];
  }
  if (error) throw new Error(error.message);
  return data ?? [];
}


/** Locations (fallback between 'locations' and 'nursery_locations') */
export async function searchLocations(q: string, orgId?: string) {
    const supabase = supabaseClient();
    let query = supabase.from("nursery_locations").select("id,name").order("name");
    if (orgId) query = query.eq("org_id", orgId);
    if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
    const { data, error } = await query.limit(50);
  
    if (error) {
      if (/relation.*does not exist/i.test(error.message ?? "")) {
        // Fallback to 'locations' if 'nursery_locations' doesn't exist
        const q2 = supabase.from("locations").select("id,name").order("name");
        if (orgId) q2.eq("org_id", orgId);
        if (q?.trim()) q2.ilike("name", `%${q.trim()}%`);
        const { data: data2, error: error2 } = await q2.limit(50);
        if (error2) throw new Error(error2.message);
        return data2 ?? [];
      }
      throw new Error(error.message);
    }
    return data ?? [];
}

/** Suppliers */
export async function searchSuppliers(q: string, orgId?: string) {
  const supabase = supabaseClient();
  let query = supabase.from("suppliers").select("id,name,country_code,producerCode").order("name");
  if (orgId) query = query.eq("org_id", orgId);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data, error } = await query.limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
