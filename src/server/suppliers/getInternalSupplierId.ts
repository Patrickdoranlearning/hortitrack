import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures we have a supplier row representing the internal "Doran Nurseries"
 * grower for the given org and returns its id. Creates the row on first use.
 */
export async function ensureInternalSupplierId(
  supabase: SupabaseClient<any, "public", any>,
  orgId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", "Doran Nurseries")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[suppliers] failed to lookup internal supplier", error);
  }

  if (data?.id) {
    return data.id;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("suppliers")
    .insert({
      org_id: orgId,
      name: "Doran Nurseries",
      supplier_type: "Plant supplier",
      country_code: "IE",
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[suppliers] failed to create internal supplier", insertErr);
    return null;
  }

  return inserted?.id ?? null;
}

