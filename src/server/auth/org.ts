import { getSupabaseServerClient } from "@/server/db/supabaseServer";
import { getSupabaseAdmin } from "@/server/db/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function getUserAndOrg() {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) throw new Error("Unauthenticated");

  const orgId = await resolveActiveOrgId({ supabase, admin, user });
  return { user, orgId, supabase };
}

export async function getActiveOrgId(existingClient?: SupabaseClient) {
  const supabase = existingClient ?? (await getSupabaseServerClient());
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
        console.error("[getUserAndOrg] fallback org lookup failed", orgErr);
        return null;
      }
      targetOrgId = orgs?.[0]?.id ?? null;
    }

    if (!targetOrgId) {
      console.error("[getUserAndOrg] no organizations available for fallback");
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
      console.error("[getUserAndOrg] failed to upsert profile", profileUpsertErr);
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
      console.error(
        "[getUserAndOrg] failed to upsert org membership",
        membershipUpsertErr
      );
      // Profile was created successfully, so still return the org ID
      // The user can function with just a profile+active_org_id
    }

    console.info(
      "[getUserAndOrg] auto-linked user to organization",
      user.id,
      targetOrgId
    );
    return targetOrgId;
  } catch (err) {
    console.error("[getUserAndOrg] ensureOrgLink failed", err);
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
  const { data: profiles, error: perr } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (perr) throw new Error(`Profile lookup failed: ${perr.message}`);

  let activeOrgId = profiles?.[0]?.active_org_id as string | null | undefined;

  if (!activeOrgId) {
    const { data: memberships, error: membershipError } = await admin
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (membershipError) {
      console.error("[getUserAndOrg] membership lookup failed", membershipError);
    }
    activeOrgId = memberships?.[0]?.org_id ?? null;
  }

  if (!activeOrgId) {
    console.info("[resolveActiveOrgId] No org found for user, attempting auto-link", user.id);
    activeOrgId = await ensureOrgLink(user, admin);
  }

  if (!activeOrgId) throw new Error("No active org selected");
  return activeOrgId;
}
