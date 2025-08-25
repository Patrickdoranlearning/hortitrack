"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (RLS via user session cookies).
 * Marked as a server file; exported function is async to satisfy Next's check:
 * "Server Actions must be async functions."
 */
export async function supabaseServer() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // no-ops in route handlers / server components (we don't mutate cookies here)
        set(name: string, value: string, options: CookieOptions) {
          // intentionally noop on the server within handlers
        },
        remove(name: string, options: CookieOptions) {
          // intentionally noop on the server within handlers
        },
      },
    }
  );
}
