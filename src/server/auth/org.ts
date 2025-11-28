import { getSupabaseServerClient } from "@/server/db/supabaseServer";
import { getSupabaseAdmin } from "@/server/db/supabase";
import type { User } from "@supabase/supabase-js";

export async function getUserAndOrg() {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdmin();

  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) throw new Error("Unauthenticated");

  const { data: profiles, error: perr } = await supabase
    .from("profiles")
    .select("active_org_id, display_name")
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
    activeOrgId = await ensureOrgLink(user, admin);
  }

  if (!activeOrgId) throw new Error("No active org selected");

  return { user, orgId: activeOrgId as string, supabase };
}

async function ensureOrgLink(user: User, admin = getSupabaseAdmin()): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();
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

    const fallbackRole =
      (user.app_metadata?.default_org_role as string | undefined) || "owner";

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
      return null;
    }

    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.email ? user.email.split("@")[0] : "User");

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
