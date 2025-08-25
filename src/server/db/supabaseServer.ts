// src/server/db/supabaseServer.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getSupabaseForRequest() {
  const cookieStore = cookies();
  return createServerClient(url, anon, {
    cookies: {
      get: (key) => cookieStore.get(key)?.value,
      set: (key, value, options) => cookieStore.set({ name: key, value, ...options }),
      remove: (key, options) => cookieStore.set({ name: key, value: "", ...options, maxAge: 0 }),
    },
    global: { headers: { "X-Client-Info": "hortitrack/web" } },
  });
}
