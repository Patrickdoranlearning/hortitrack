// src/server/db/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );
}

export async function getActiveOrgIdOrThrow(client: ReturnType<typeof getSupabaseForRequest>) {
  const { data: userRes, error: userErr } = await client.auth.getUser();
  if (userErr || !userRes.user) throw new Error("Unauthenticated");
  const { data, error } = await client
    .from("profiles")
    .select("active_org_id")
    .eq("id", userRes.user.id)
    .single();
  if (error || !data?.active_org_id) throw new Error("No active org selected");
  return data.active_org_id as string;
}