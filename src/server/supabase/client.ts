"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

let _onceLogged = false;

function assertEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase env missing: expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Routes that use supabaseServer() cannot run without them."
    );
  }
  if (!_onceLogged) {
    // Log once per process to make debugging crystal clear
    console.log(`[supabaseServer] Using ${url}`);
    _onceLogged = true;
  }
  return { url, anon };
}

/**
 * Server-side Supabase client (RLS via user session cookies).
 * Marked as a server file; exported function is async to satisfy Next's check:
 * "Server Actions must be async functions."
 */
export async function supabaseServer() {
  const { url, anon } = assertEnv();
  const cookieStore = cookies();

  return createServerClient(
    url,
    anon,
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
