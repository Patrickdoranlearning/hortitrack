// src/server/db/supabaseServer.ts
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { type Database } from "@/types/supabase"; // your generated types if available
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

export async function getSupabaseForRequest(req?: Request) {
  const cookieStore = await cookies();
  // @ts-expect-error next/headers in route handlers
  const _h = await headers();
  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options) {
          cookieStore.set(name, '', options);
        },
      },
    }
  );
  return supabase;
}

// Re-added this function from a previous version as it seems to be used elsewhere.
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
