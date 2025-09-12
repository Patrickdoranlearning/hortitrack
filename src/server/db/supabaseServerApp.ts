// src/server/db/supabaseServerApp.ts
// Universal server client factory — SAFE to import from pages/ or app/
// Does NOT import "server-only" or "next/headers".

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// Minimal cookie bridge interface to avoid next/headers dependency here.
export type CookieBridge = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options: CookieOptions) => void;
  remove: (name: string, options: CookieOptions) => void;
};

/**
 * Create a server-side Supabase client by supplying a cookie bridge.
 * - In App Router, build a bridge from next/headers `cookies()` in the caller.
 * - In Pages Router/API routes, build a bridge from req/res cookies in the caller.
 */
export function createSupabaseServerWithCookies(
  cookieBridge: CookieBridge
): SupabaseClient<Database> {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: cookieBridge,
  });
}
