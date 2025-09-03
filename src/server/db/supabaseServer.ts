import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side client bound to the caller's session by injecting
 * Authorization from either the incoming request header or cookies.
 * No extra packages required.
 */
export function getSupabaseForRequest(req?: Request): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // 1) Prefer Authorization header if present (client forwarded)
  let authHeader: string | undefined = req?.headers.get("authorization") ?? req?.headers.get("Authorization") ?? undefined;
  // 2) Fallback to cookie (if you later add helpers that write it)
  if (!authHeader) {
    const access = cookies().get("sb-access-token")?.value;
    if (access) authHeader = `Bearer ${access}`;
  }
  return createClient(url, anon, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
