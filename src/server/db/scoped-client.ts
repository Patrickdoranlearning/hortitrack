/**
 * Organization-Scoped Supabase Client Utility
 *
 * Provides a wrapper pattern for ensuring org_id is always included in queries.
 * This adds defense-in-depth on top of RLS policies.
 *
 * Usage:
 *   import { getOrgScopedClient } from '@/server/db/scoped-client';
 *
 *   // In an API route or server action:
 *   const { client, orgId, userId } = await getOrgScopedClient();
 *
 *   // The client is already authenticated, use orgId in queries:
 *   const { data } = await client
 *     .from("batches")
 *     .select("*")
 *     .eq("org_id", orgId);  // Always filter by org_id!
 */

import { getUserAndOrg } from "@/server/auth/org";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrgScopedClientContext {
  /** The Supabase admin client (bypasses RLS, so always filter by orgId!) */
  client: SupabaseClient;
  /** The authenticated user's active organization ID - ALWAYS use in queries */
  orgId: string;
  /** The authenticated user's ID */
  userId: string;
  /** The authenticated user's email (if available) */
  userEmail?: string;
}

/**
 * Get an organization-scoped Supabase client context.
 *
 * This wraps getUserAndOrg() and returns a consistent interface for
 * server-side code that needs to query data scoped to the user's org.
 *
 * IMPORTANT: The returned client is an admin client that bypasses RLS.
 * You MUST include .eq("org_id", orgId) in ALL queries to maintain
 * multi-tenant data isolation.
 *
 * @throws Error if user is not authenticated or has no active org
 *
 * @example
 * const { client, orgId } = await getOrgScopedClient();
 *
 * // Good - includes org_id filter
 * const { data } = await client.from("orders").select("*").eq("org_id", orgId);
 *
 * // BAD - missing org_id, exposes all orgs' data!
 * const { data } = await client.from("orders").select("*"); // DON'T DO THIS!
 */
export async function getOrgScopedClient(): Promise<OrgScopedClientContext> {
  const { user, orgId, supabase } = await getUserAndOrg();

  return {
    client: supabase,
    orgId,
    userId: user.id,
    userEmail: user.email ?? undefined,
  };
}

/**
 * Type helper for query builders that require org_id
 * Use this to document that a function expects org-scoped queries
 */
export type OrgScopedQuery<T> = T & { _orgScoped: true };

/**
 * Validates that a UUID is properly formatted
 * Use this to validate org_id before queries
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
