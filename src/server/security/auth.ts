import 'server-only';
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  try {
    const h = req.headers.get("authorization") || "";
    const m = /^bearer\s+(.+)$/i.exec(h);
    const token = m?.[1]?.trim();

    const supabase = await createClient();

    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return null;
      return user;
    }

    // Fallback to cookie session if no bearer token
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;

  } catch {
    return null;
  }
}
