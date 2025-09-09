import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseServerClient() {
  const cookieStore = cookies();
  const hdrs = headers();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set() {/* no-op server */},
      remove() {/* no-op server */},
    },
    headers: {
      "x-forwarded-for": hdrs.get("x-forwarded-for") ?? undefined,
      "user-agent": hdrs.get("user-agent") ?? undefined,
    },
  });
}
