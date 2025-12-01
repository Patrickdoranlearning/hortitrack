import "server-only";

import {
  createSupabaseServerWithCookies,
  getSupabaseServerApp,
  type CookieBridge,
} from "./supabaseServerApp";
import { getSupabaseForRequest, getSupabaseServerClient } from "./supabaseServer";
import { getSupabaseServerPages } from "./supabaseServerPages";
import { supabaseBrowser } from "./supabaseBrowser";
import { supabaseAdmin } from "./supabaseAdmin";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from "./env";

function asBoolean(value?: string | null): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const dualwriteFlag =
  process.env.SUPABASE_DUALWRITE_ENABLED ??
  process.env.SUPABASE_DUALWRITE ??
  process.env.ENABLE_SUPABASE_DUALWRITE ??
  process.env.ENABLE_DUALWRITE ??
  process.env.DUALWRITE;

export function dualWriteEnabled(): boolean {
  return asBoolean(dualwriteFlag);
}

export function getSupabaseAdmin() {
  return supabaseAdmin;
}

export {
  CookieBridge,
  createSupabaseServerWithCookies,
  getSupabaseServerApp,
  getSupabaseServerClient,
  getSupabaseForRequest,
  getSupabaseServerPages,
  supabaseBrowser,
  supabaseAdmin,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
};

