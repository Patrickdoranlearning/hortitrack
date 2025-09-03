// src/lib/supabase/browserClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton browser Supabase client (no custom storageKey).
 * Uses Supabase default key: sb-<project-ref>-auth-token.
 */
export function getBrowserSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const g = globalThis as any;
  if (!g.__sb_client) {
    if (!url || !anon) {
      console.warn("[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    } else {
      console.debug("[supabaseClient] Using", url);
    }
    g.__sb_client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // IMPORTANT: no storageKey override — use Supabase default
      },
    }) as SupabaseClient;
  }
  return g.__sb_client as SupabaseClient;
}

/**
 * Get the current access token, with robust fallbacks:
 * 1) supabase-js session
 * 2) default localStorage key: sb-…-auth-token
 * 3) legacy "hortitrack.auth" (if previously used)
 */
export async function getAccessToken(sb?: SupabaseClient): Promise<string | undefined> {
  const client = sb ?? getBrowserSupabase();

  try {
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (token) return token;
  } catch {}

  // Fallback: scan default Supabase storage key(s)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const o = JSON.parse(raw);
        const t =
          o?.access_token ||
          o?.currentSession?.access_token ||
          o?.session?.access_token ||
          o?.user?.access_token;
        if (typeof t === "string" && t.length > 10) return t;
      }
    }
  } catch {}

  // Legacy fallback
  try {
    const raw = localStorage.getItem("hortitrack.auth");
    if (raw) {
      const o = JSON.parse(raw);
      const t = o?.session?.access_token || o?.access_token;
      if (typeof t === "string" && t.length > 10) return t;
    }
  } catch {}

  return undefined;
}
