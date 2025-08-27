
"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

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
    console.log(`[supabaseServer] Using ${url}`);
    _onceLogged = true;
  }
  return { url, anon };
}

export async function supabaseServer() {
  const { url, anon } = assertEnv();
  const cookieStore = cookies();

  try {
    return createServerClient(
      url,
      anon,
      {
        cookies: {
          async get(name: string) { 
            return await cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // noop
          },
          remove(name: string, options: CookieOptions) {
            // noop
          },
        },
      }
    );
  } catch (error) {
    console.error("Error creating Supabase server client:", error); 
    throw error;
  }
}
