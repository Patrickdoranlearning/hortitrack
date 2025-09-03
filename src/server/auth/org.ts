// NEW: src/server/auth/org.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveOrgId(sb: SupabaseClient): Promise<string> {
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) throw new Error("Unauthenticated");
  const { data, error } = await sb
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data?.active_org_id) throw new Error("No active org set");
  return data.active_org_id as string;
}
