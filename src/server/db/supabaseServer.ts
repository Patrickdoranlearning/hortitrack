// src/server/db/supabaseServer.ts
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { type Database } from "@/types/supabase"; // your generated types if available

export function getSupabaseForRequest(req?: Request) {
  const cookieStore = cookies();
  // @ts-expect-error next/headers in route handlers
  const h = headers();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
export function getSupabaseServerClient() {
    const cookieStore = cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
            },
        }
    )
}
