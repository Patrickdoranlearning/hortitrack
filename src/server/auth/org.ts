import { getSupabaseServerClient } from "@/server/db/supabaseServer";

export async function getUserAndOrg() {
  const supabase = getSupabaseServerClient();

  const { data: { user }, error: uerr } = await supabase.auth.getUser();
  if (uerr || !user) throw new Error("Unauthenticated");

  const { data: profile, error: perr } = await supabase
    .from("profiles")
    .select("active_org_id, display_name")
    .eq("id", user.id)
    .single();

  if (perr) throw new Error(`Profile lookup failed: ${perr.message}`);
  if (!profile?.active_org_id) throw new Error("No active org selected");

  return { user, orgId: profile.active_org_id as string, supabase };
}
