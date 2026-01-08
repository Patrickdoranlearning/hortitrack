import 'server-only';
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/server/db/supabase";
import type { UserSession } from "@/lib/types";

import { DEV_USER_ID, DEV_ORG_ID, IS_DEV } from "@/server/auth/dev-bypass";

export async function getUserFromRequest(req: NextRequest): Promise<UserSession | null> {
  try {
    const h = req.headers.get("authorization") || "";
    const m = /^bearer\s+(.+)$/i.exec(h);
    const token = m?.[1]?.trim();

    const supabase = await createClient();
    const admin = getSupabaseAdmin();
    let orgId: string | null = null;
    let role: string | null = null;
    let user = null;

    if (token) {
      const result = await supabase.auth.getUser(token);
      if (result.data?.user) {
        user = result.data.user;
      }
    }
    if (!user) {
      const result = await supabase.auth.getUser();
      if (result.data?.user) {
        user = result.data.user;
      }
    }

    // DEV BYPASS
    if (!user && IS_DEV) {
      const { data } = await admin.auth.admin.getUserById(DEV_USER_ID);
      user = data.user;
      orgId = DEV_ORG_ID; // Force Org ID for dev
    }

    if (!user) return null;

    // console.log("getUserFromRequest: found user", user.id);

    if (!orgId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.active_org_id) {
        orgId = profile.active_org_id;
      } else {
        // console.log("getUserFromRequest: no active_org_id in profile for user", user.id);
      }
    }

    if (!orgId || !role) {
      const { data: membership } = await admin
        .from("org_memberships")
        .select("org_id, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (membership) {
        orgId = orgId ?? membership.org_id ?? null;
        role = role ?? (membership.role as string | null) ?? null;
      } else {
        console.log("getUserFromRequest: no membership found for user", user.id);
      }
    }

    role = role ?? (user.app_metadata?.role as string | undefined) ?? null;

    if (!orgId) console.log("getUserFromRequest: returning null because no orgId resolved");

    return {
      uid: user.id,
      email: user.email ?? undefined,
      orgId,
      role,
    };
  } catch (err) {
    console.error("[auth] getUserFromRequest failed", err);
    return null;
  }
}
