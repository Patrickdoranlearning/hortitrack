import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Supabase env missing: set SUPABASE_SERVICE_ROLE_KEY for admin access."
  );
}

export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);
