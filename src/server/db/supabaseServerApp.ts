// src/server/db/supabaseServerApp.ts
// Universal server client factory — SAFE to import from pages/ or app/
// Does NOT import "server-only" or "next/headers".

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  return createServerClient<Database>(url, key, { cookies: cookieBridge });
}
