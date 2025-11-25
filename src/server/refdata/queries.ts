import { getSupabaseServerApp } from "@/server/db/supabase";
import { snakeToCamel } from "@/lib/utils";

// Global search (no org filter)
export async function searchVarieties(q: string) {
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("plant_varieties")
    .select("id,name,family")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}

// Global search (no org filter)
export async function searchSizes(q: string) {
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("plant_sizes")
    .select("id,name,container_type,cell_multiple as multiple") // Alias cell_multiple to multiple
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}

// Org-scoped search
export async function searchLocations(q: string, orgId?: string) {
  if (!orgId) return []; // Do not search if no orgId is provided
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("nursery_locations")
    .select("id,name")
    .eq("org_id", orgId) // Filter by org_id
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}

// Org-scoped search
export async function searchSuppliers(q: string, orgId?: string) {
  if (!orgId) return []; // Do not search if no orgId is provided
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name,country_code")
    .eq("org_id", orgId) // Filter by org_id
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}
