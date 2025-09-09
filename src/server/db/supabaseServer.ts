import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseServerClient() {
  const cookieStore = cookies();
  const hdrs = headers();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Important: forward cookies so RLS sees the user session
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set() { /* no-op on server */ },
      remove() { /* no-op on server */ },
    },
  });
}

// Back-compat alias used in existing routes
export const getSupabaseForRequest = getSupabaseServerClient;
