// src/server/db/supabaseServer.ts
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
