// src/server/auth/getUser.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "crypto";

export type ServerUser = { uid: string; email?: string; orgId?: string };

import { DEV_USER_ID, DEV_ORG_ID, IS_DEV } from "@/server/auth/dev-bypass";

export async function getUserIdAndOrgId(): Promise<{ userId: string | null; orgId: string | null; email: string | null }> {
  const supabase = await createClient();

  const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();

  const user = fetchedUser;
  if (IS_DEV && (!user || userError)) {
    return { userId: DEV_USER_ID, orgId: DEV_ORG_ID, email: "dev@example.com" };
  }

  if (userError || !user) {
    // console.error("Error getting Supabase user:", userError?.message);
    return { userId: null, orgId: null, email: null };
  }

  // Now, fetch the active_org_id from the public.profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id as UUID)
    .single();

  if (profileError) {
    console.error("Error fetching user profile for org ID:", profileError.message);
    return { userId: user.id, orgId: null, email: user.email || null };
  }

  return { userId: user.id, orgId: profile.active_org_id, email: user.email || null };
}

// Keep getUser and getOptionalUser for compatibility if other parts of the app use them,
// but adapt them to use Supabase auth.
export async function getUser(): Promise<ServerUser> {
  const { userId, orgId } = await getUserIdAndOrgId();
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }
  // You might want to fetch more user details here if needed
  return { uid: userId, orgId: orgId ?? undefined };
}

export async function getOptionalUser(): Promise<ServerUser | null> {
  const { userId, orgId } = await getUserIdAndOrgId();
  if (!userId) {
    return null;
  }
  return { uid: userId, orgId: orgId ?? undefined };
}

export type OrgRole = 'owner' | 'admin' | 'grower' | 'sales' | 'viewer';

/**
 * Get the user's role within their active organization
 * Returns null if user is not authenticated or has no membership
 */
export async function getUserRole(): Promise<{ userId: string; orgId: string; role: OrgRole } | null> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (IS_DEV && (!user || userError)) {
    // Dev bypass - assume admin role
    return { userId: DEV_USER_ID, orgId: DEV_ORG_ID, role: 'admin' };
  }

  if (userError || !user) {
    return null;
  }

  // Get profile with active_org_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.active_org_id) {
    return null;
  }

  // Get user's role in this org
  const { data: membership, error: membershipError } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", profile.active_org_id)
    .single();

  if (membershipError || !membership) {
    return null;
  }

  return {
    userId: user.id,
    orgId: profile.active_org_id,
    role: membership.role as OrgRole,
  };
}

/**
 * Check if the current user has one of the required roles
 * Returns error info if not authorized
 */
export async function requireRole(
  allowedRoles: OrgRole[]
): Promise<{ authorized: true; userId: string; orgId: string; role: OrgRole } | { authorized: false; error: string; status: 401 | 403 }> {
  const userRole = await getUserRole();

  if (!userRole) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  if (!allowedRoles.includes(userRole.role)) {
    return { authorized: false, error: "Insufficient permissions", status: 403 };
  }

  return { authorized: true, ...userRole };
}
