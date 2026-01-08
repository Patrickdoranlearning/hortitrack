"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function supabaseClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url === "https://placeholder.supabase.co") {
    console.error("Supabase environment variables are missing. Please check your .env file.");
  }

  client = createBrowserClient(
    url ?? "https://placeholder.supabase.co",
    anonKey ?? "placeholder"
  );

  return client;
}

export const createClient = supabaseClient;
