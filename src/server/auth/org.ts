import { getSupabaseServerClient } from "@/server/db/supabaseServer";

export async function getUserAndOrg() {
  const supabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Unauthenticated");

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("active_org_id, display_name")
    .eq("id", user.id)
    .single();

  if (profErr) throw new Error(`Profile lookup failed: ${profErr.message}`);
  if (!profile?.active_org_id) throw new Error("No active org selected");

  return { user, orgId: profile.active_org_id as string, supabase };
}
