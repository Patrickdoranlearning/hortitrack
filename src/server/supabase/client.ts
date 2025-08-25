import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Async factory to satisfy Next's server action checker.
export async function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {/* noop on server */},
        remove() {/* noop on server */},
      },
    }
  );
}
