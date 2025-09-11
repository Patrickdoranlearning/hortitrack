"use client";

import { createBrowserClient } from "@supabase/ssr";

let _onceLogged = false;

function assertEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !url.startsWith("http") || !anon) {
    throw new Error(
      "Supabase env missing or invalid: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment."
    );
  }
  if (!_onceLogged) {
    console.log(`[supabaseClient] Using ${url}`);
    _onceLogged = true;
  }
  return { url, anon };
}

export function supabaseClient() {
  const { url, anon } = assertEnv();
  return createBrowserClient(url, anon);
}