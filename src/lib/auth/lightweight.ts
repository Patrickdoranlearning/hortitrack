import "server-only";
import { createClient } from "@/lib/supabase/server";

import { DEV_USER_ID, DEV_ORG_ID, IS_DEV } from "@/server/auth/dev-bypass";
import { getSupabaseAdmin } from "@/server/db/supabase";

// In-memory cache for org resolution (short TTL, cleared on auth changes)
const orgCache = new Map<string, { orgId: string; timestamp: number }>();
const ORG_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Lightweight auth check that returns user and orgId
 * Optimized: Caches org_id lookup to reduce database round-trips
 * 
 * @returns { user, orgId } or throws if unauthenticated
 */
export async function getLightweightAuth() {
  const supabase = await createClient();
  const admin = getSupabaseAdmin();

  // Get authenticated user
  const { data: { user: fetchedUser }, error: authError } = await supabase.auth.getUser();

  let user = fetchedUser;

  // DEV BYPASS
  if (IS_DEV && (!user || authError)) {
    const { data } = await admin.auth.admin.getUserById(DEV_USER_ID);
    user = data.user;
    if (user) {
      // Pre-seed cache for dev user to skip profile lookup
      orgCache.set(user.id, { orgId: DEV_ORG_ID, timestamp: Date.now() });
    }
  }

  if (authError && !user) { // Only throw if bypass failed or not active
    throw new Error("Unauthenticated");
  }
  if (!user) throw new Error("Unauthenticated");

  // Check org cache first
  const cached = orgCache.get(user.id);
  if (cached && Date.now() - cached.timestamp < ORG_CACHE_TTL) {
    return { user, orgId: cached.orgId, supabase };
  }

  // Get org_id from profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Profile lookup failed: ${profileError.message}`);
  }

  const orgId = profile?.active_org_id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  // Cache the org_id
  orgCache.set(user.id, { orgId, timestamp: Date.now() });

  return { user, orgId, supabase };
}

/**
 * Clear the org cache for a user (call after org switch)
 */
export function clearOrgCache(userId?: string) {
  if (userId) {
    orgCache.delete(userId);
  } else {
    orgCache.clear();
  }
}

/**
 * Get just the orgId without full auth context
 * Throws if unauthenticated or no org selected
 */
export async function getOrgIdOnly(): Promise<string> {
  const { orgId } = await getLightweightAuth();
  return orgId;
}



