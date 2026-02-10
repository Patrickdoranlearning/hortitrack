// src/app/api/catalog/suppliers/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/utils/logger";

const Query = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(50),
});

async function getOrgId(supabase: SupabaseClient) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.user.id)
    .single();
  return profile?.active_org_id ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Query.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ error: parse.error.format() }, { status: 400 });

  const { q, limit } = parse.data;
  const supabase = await createClient();

  const orgId = await getOrgId(supabase);
  if (!orgId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let query = supabase
    .from("suppliers")
    .select("id,name,producer_code,country_code")
    .eq("org_id", orgId)
    .order("name", { ascending: true })
    .limit(limit);
  if (q && q.length > 0) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    logger.api.error("Catalog suppliers select failed", error);
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }

  return NextResponse.json(
    data.map(s => ({
      value: s.id,
      label: s.name,
      meta: { producer_code: s.producer_code, country_code: s.country_code },
    }))
  );
}
