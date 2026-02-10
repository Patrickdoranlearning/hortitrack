import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/utils/logger";

/**
 * Ensures we have a supplier row representing the internal/own nursery
 * grower for the given org and returns its id. Creates the row on first use.
 * The supplier is created with the organization's name.
 */
export async function ensureInternalSupplierId(
  supabase: SupabaseClient<any, "public", any>,
  orgId: string
): Promise<string | null> {
  // Look for an existing internal supplier by is_internal flag
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("org_id", orgId)
    .eq("is_internal", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.suppliers.error("Failed to lookup internal supplier", error, { orgId });
  }

  if (data?.id) {
    return data.id;
  }

  // Get the organization name for the new supplier
  const { data: org } = await supabase
    .from("organizations")
    .select("name, country_code")
    .eq("id", orgId)
    .single();

  const orgName = org?.name ?? "Internal";
  const countryCode = org?.country_code ?? "IE";

  // Create the internal supplier with the org's name and is_internal flag
  const { data: inserted, error: insertErr } = await supabase
    .from("suppliers")
    .insert({
      org_id: orgId,
      name: orgName,
      is_internal: true,
      supplier_type: "Plant supplier",
      country_code: countryCode,
    })
    .select("id")
    .single();

  if (insertErr) {
    logger.suppliers.error("Failed to create internal supplier", insertErr, { orgId });
    return null;
  }

  return inserted?.id ?? null;
}

