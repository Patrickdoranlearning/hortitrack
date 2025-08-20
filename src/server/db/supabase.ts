import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

let supabase: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabase) return supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE missing).");
  }
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "hortitrack/dual-write" } },
  });
  return supabase;
}

export function dualWriteEnabled() {
  return process.env.DUAL_WRITE === "1" && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE;
}
