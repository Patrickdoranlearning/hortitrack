import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures we have a supplier row representing the internal/own nursery
 * grower for the given org and returns its id. Creates the row on first use.
 * The supplier is created with the organization's name.
 */
export async function ensureInternalSupplierId(
  supabase: SupabaseClient<any, "public", any>,
  orgId: string
): Promise<string | null> {
  // First get the organization name
  const { data: org } = await supabase
    .from("organizations")
    .select("name, country_code")
    .eq("id", orgId)
    .single();

  const orgName = org?.name ?? "Internal";
  const countryCode = org?.country_code ?? "IE";

  // Look for an existing supplier with the org's name
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", orgName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[suppliers] failed to lookup internal supplier", error);
  }

  if (data?.id) {
    return data.id;
  }

  // Create the internal supplier with the org's name
  const { data: inserted, error: insertErr } = await supabase
    .from("suppliers")
    .insert({
      org_id: orgId,
      name: orgName,
      supplier_type: "Plant supplier",
      country_code: countryCode,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[suppliers] failed to create internal supplier", insertErr);
    return null;
  }

  return inserted?.id ?? null;
}

