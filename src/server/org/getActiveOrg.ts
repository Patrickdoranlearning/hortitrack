import "server-only";
import { createSupabaseServerWithCookies, type CookieBridge } from "@/server/db/supabaseServerApp";
import { cookies } from "next/headers";

function getSupabaseForApp() {
  const store = cookies();
  const cookieBridge: CookieBridge = {
    get: (n) => store.get(n)?.value,
    set: (n, v, o) => store.set(n, v, o),
    remove: (n, o) => store.set(n, "", { ...o, maxAge: 0 }),
  };
  return createSupabaseServerWithCookies(cookieBridge);
}

export async function resolveActiveOrgId(): Promise<string | null> {
  const supabase = getSupabaseForApp();

  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id ?? null;

  if (uid) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", uid)
      .maybeSingle();
    if (prof?.active_org_id) return prof.active_org_id as string;

    const { data: mem } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", uid)
      .limit(1);
    if (mem?.[0]?.org_id) return mem[0].org_id as string;
  }

  // Fallbacks: prefer Doran Nurseries (by name), else any org
  const { data: byName } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "Doran Nurseries")
    .maybeSingle();
  if (byName?.id) return byName.id as string;

  const { data: anyOrg } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  return anyOrg?.[0]?.id ?? null;
}
