import "server-only";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { resolveActiveOrgId } from "./getActiveOrg";
import type { Organization, OrganizationSummary } from "@/types/organization";
import { logger } from "@/server/utils/logger";

const DEFAULT_COMPANY_NAME = "HortiTrack";

/**
 * Fetches the full organization object for the active org
 * Returns null if no organization is found
 */
export async function getOrganization(): Promise<Organization | null> {
  const orgId = await resolveActiveOrgId();

  if (!orgId) {
    return null;
  }

  const supabase = await getSupabaseServerApp();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    logger.org.error("Failed to fetch organization", error);
    return null;
  }

  return org as Organization;
}

/**
 * Fetches minimal organization data (id, name, logo) for the active org
 * Returns null if no organization is found
 */
export async function getOrganizationSummary(): Promise<OrganizationSummary | null> {
  const orgId = await resolveActiveOrgId();

  if (!orgId) {
    return null;
  }

  const supabase = await getSupabaseServerApp();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, logo_url")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    logger.org.error("Failed to fetch organization summary", error);
    return null;
  }

  return org as OrganizationSummary;
}

/**
 * Gets the company name for the active organization
 * Returns "HortiTrack" as fallback if no org is configured
 */
export async function getCompanyName(): Promise<string> {
  const org = await getOrganizationSummary();
  return org?.name ?? DEFAULT_COMPANY_NAME;
}
