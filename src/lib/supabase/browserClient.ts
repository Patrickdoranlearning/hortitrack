// src/lib/supabase/browserClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight browser Supabase client.
 * Uses anon key; session persists in the browser.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // Singleton to avoid "Multiple GoTrueClient instances"
  let _global = globalThis as any;
  if (!_global.__sb_client) {
    if (!url || !anon) {
      console.warn("[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    } else {
      console.debug("[supabaseClient] Using", url);
    }
    _global.__sb_client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "hortitrack.auth", // isolate from other apps
      },
    }) as SupabaseClient;
  }
  return _global.__sb_client as SupabaseClient;
}
