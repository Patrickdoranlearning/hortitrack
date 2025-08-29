import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Q = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Q.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ options: [] });

  const supabase = getSupabaseForRequest();

  // must be signed in + have an active org
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ options: [] });

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.active_org_id) return NextResponse.json({ options: [] });

  const { q, limit } = parse.data;

  let query = supabase
    .from("sites")
    .select("id,name")
    .eq("org_id", profile.active_org_id)
    .order("name", { ascending: true })
    .limit(limit);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[options.sites]", error);
    return NextResponse.json({ options: [] });
  }

  return NextResponse.json({
    options: (data ?? []).map(s => ({ value: s.id, label: s.name })),
  });
}