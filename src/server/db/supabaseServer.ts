import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function getSupabaseForRequest() {
  const cookieStore = cookies();
  const headerList = headers();
  // Leverage public envs; no .env.local edits here
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: () => {}, // No-op in route handlers
      remove: () => {}
    },
    headers: {
      get: (name: string) => headerList.get(name) ?? undefined,
    },
  });
}