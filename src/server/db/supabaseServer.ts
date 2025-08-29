// src/server/db/supabaseServer.ts
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseServerApp } from "./supabaseServerApp";

export function getSupabaseForRequest() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // Next.js App Router manages cookies; no-op here.
        },
        remove() {
          // Next.js App Router manages cookies; no-op here.
        },
      },
      // Forward client IP for Supabase logs (optional)
      global: { headers: { "x-forwarded-for": headers().get("x-forwarded-for") ?? "" } },
    }
  );
}

export async function getActiveOrgIdOrThrow(supabase: ReturnType<typeof getSupabaseForRequest>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("profiles")
        .select("active_org_id")
        .eq("id", user.id)
        .single();
    
    if (error) throw new Error(`Could not load profile: ${error.message}`);
    if (!data?.active_org_id) throw new Error("No active organization set for user.");

    return data.active_org_id;
}
