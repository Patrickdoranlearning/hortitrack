
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/server/db/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { logError, logInfo } from "@/lib/log";

import { DEV_USER_ID, IS_DEV } from "@/server/auth/dev-bypass";

export async function getUserAndOrg() {
  const supabase = await createClient();
  const admin = getSupabaseAdmin();

  const {
    data: { user: fetchedUser },
    error: uerr,
  } = await supabase.auth.getUser();

  let user = fetchedUser;

  // DEV BYPASS
  if (IS_DEV && (!user || uerr)) {
    const { data } = await admin.auth.admin.getUserById(DEV_USER_ID);
    user = data.user;
  }

  if (!user) throw new Error("Unauthenticated");

  const orgId = await resolveActiveOrgId({ supabase, admin, user });
  // Return admin client for server-side queries to bypass RLS
  // Security is maintained by always filtering by orgId in queries
  return { user, orgId, supabase: admin };
}

export async function getOrgDetails() {
  const { supabase, orgId } = await getUserAndOrg();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, latitude, longitude")
    .eq("id", orgId)
    .single();

  if (error || !data) throw new Error("Organization not found");
  return data;
}

export async function getActiveOrgId(existingClient?: SupabaseClient) {
  const supabase = existingClient ?? (await createClient());
  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthenticated");

  return resolveActiveOrgId({ supabase, admin, user });
}

async function ensureOrgLink(user: User, adminClient?: SupabaseClient): Promise<string | null> {
  try {
    const admin = adminClient ?? getSupabaseAdmin();
    let targetOrgId =
      process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ||
      process.env.DEFAULT_ORG_ID ||
      null;

    if (!targetOrgId) {
      const { data: orgs, error: orgErr } = await admin
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      if (orgErr) {
        logError("[getUserAndOrg] fallback org lookup failed", { error: orgErr });
        return null;
      }
      targetOrgId = orgs?.[0]?.id ?? null;
    }

    if (!targetOrgId) {
      logError("[getUserAndOrg] no organizations available for fallback");
      return null;
    }

    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.email ? user.email.split("@")[0] : "User");

    // Create profile FIRST (org_memberships has a foreign key to profiles)
    const { error: profileUpsertErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: displayName,
          email: user.email ?? null,
          active_org_id: targetOrgId,
        },
        { onConflict: "id" }
      );
    if (profileUpsertErr) {
      logError("[getUserAndOrg] failed to upsert profile", { error: profileUpsertErr });
      return null;
    }

    // Then create the org membership
    const fallbackRole =
      (user.app_metadata?.default_org_role as string | undefined) || "editor";

    const { error: membershipUpsertErr } = await admin
      .from("org_memberships")
      .upsert(
        {
          org_id: targetOrgId,
          user_id: user.id,
          role: fallbackRole,
        },
        { onConflict: "org_id,user_id" }
      );
    if (membershipUpsertErr) {
      logError("[getUserAndOrg] failed to upsert org membership", {
        error: membershipUpsertErr,
      });
      // Profile was created successfully, so still return the org ID
      // The user can function with just a profile+active_org_id
    }

    logInfo("[getUserAndOrg] auto-linked user to organization", {
      userId: user.id,
      orgId: targetOrgId,
    });
    return targetOrgId;
  } catch (err) {
    logError("[getUserAndOrg] ensureOrgLink failed", { error: err });
    return null;
  }
}

async function resolveActiveOrgId({
  supabase,
  admin,
  user,
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  user: User;
}): Promise<string> {
  // OPTIMIZATION: Run profile and membership queries in parallel
  // Most users will have active_org_id set, but we fetch both to avoid
  // sequential round-trips when the fallback is needed
  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  if (profileResult.error) {
    throw new Error(`Profile lookup failed: ${profileResult.error.message}`);
  }

  // Use active_org_id from profile if set, otherwise fall back to membership
  let activeOrgId = profileResult.data?.active_org_id as string | null | undefined;

  if (!activeOrgId) {
    if (membershipResult.error) {
      logError("[getUserAndOrg] membership lookup failed", { error: membershipResult.error });
    }
    activeOrgId = membershipResult.data?.[0]?.org_id ?? null;
  }

  if (!activeOrgId) {
    logInfo("[resolveActiveOrgId] No org found for user, attempting auto-link", { userId: user.id });
    activeOrgId = await ensureOrgLink(user, admin);
  }

  if (!activeOrgId) throw new Error("No active org selected");
  return activeOrgId;
}
