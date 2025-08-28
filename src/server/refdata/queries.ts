import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { snakeToCamel } from "@/lib/utils";

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

export async function searchSizes(q: string) {
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("plant_sizes")
    .select("id,name,container_type")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}

export async function searchLocations(q: string) {
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("nursery_locations")
    .select("id,name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}

export async function searchSuppliers(q: string) {
  const supabase = getSupabaseServerApp();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name,country_code")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(25);
  if (error) throw new Error(error.message);
  return snakeToCamel(data ?? []);
}
