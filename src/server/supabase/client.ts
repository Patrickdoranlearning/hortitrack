"use server";

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server client (RLS via user session)
export function supabaseServer() {
  const cookieStore = cookies();
  const hdrs = headers();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() { /* server */ },
        remove() { /* server */ },
      },
      headers: { "x-forwarded-for": hdrs.get("x-forwarded-for") ?? undefined },
    },
  );
}
