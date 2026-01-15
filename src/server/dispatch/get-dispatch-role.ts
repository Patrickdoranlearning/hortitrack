import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { DEV_USER_ID, DEV_ORG_ID, IS_DEV } from "@/server/auth/dev-bypass";
import { type DispatchRole, getDispatchRole } from "@/lib/dispatch/types";

/**
 * Get the dispatch-specific role for the current user.
 * Returns 'manager', 'picker', or 'driver' based on their org membership role.
 */
export async function getDispatchRoleForUser(): Promise<{
  role: DispatchRole;
  userId: string;
  orgId: string;
}> {
  const supabase = await createClient();
  const admin = getSupabaseAdmin();

  const {
    data: { user: fetchedUser },
    error: userError,
  } = await supabase.auth.getUser();

  const user = fetchedUser;

  // DEV BYPASS
  if (IS_DEV && (!user || userError)) {
    // In dev mode, default to manager role
    return {
      role: "manager",
      userId: DEV_USER_ID,
      orgId: DEV_ORG_ID,
    };
  }

  if (!user) {
    throw new Error("Unauthenticated");
  }

  // Get the user's active org from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.active_org_id;
  if (!orgId) {
    throw new Error("No active organization");
  }

  // Get the user's role in this org
  const { data: membership } = await admin
    .from("org_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();

  const orgRole = (membership?.role as string) || "staff";
  const dispatchRole = getDispatchRole(orgRole);

  return {
    role: dispatchRole,
    userId: user.id,
    orgId,
  };
}
