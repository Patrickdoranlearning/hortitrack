"use client";

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server-side Supabase client (RLS via user session cookies)
// Not a Server Action; safe to import in route handlers & server components.
export function supabaseServer() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
        // In some server component contexts, cookies() is readonly; keep no-ops safe.
        set() {/* noop */},
        remove() {/* noop */},
      },
    }
  );
}
