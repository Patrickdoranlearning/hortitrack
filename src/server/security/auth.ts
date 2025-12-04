import 'server-only';
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/server/db/supabase";
import type { UserSession } from "@/lib/types";

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
      if (result.error || !result.data.user) return null;
      user = result.data.user;
    }
    if (!user) {
      const result = await supabase.auth.getUser();
      if (result.error || !result.data.user) return null;
      user = result.data.user;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.active_org_id) {
      orgId = profile.active_org_id;
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
      }
    }

    role = role ?? (user.app_metadata?.role as string | undefined) ?? null;

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
