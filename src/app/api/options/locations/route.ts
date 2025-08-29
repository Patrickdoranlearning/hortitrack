import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";

const Q = z.object({
  q: z.string().trim().optional(),
  site: z.string().trim().optional(),   // site name, not uuid
  limit: z.coerce.number().min(1).max(200).default(50),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = Q.safeParse(Object.fromEntries(searchParams));
  if (!parse.success) return NextResponse.json({ options: [] });

  const supabase = getSupabaseForRequest();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ options: [] });

  const { data: profile } = await supabase
    .from("profiles").select("active_org_id").eq("id", auth.user.id).maybeSingle();
  if (!profile?.active_org_id) return NextResponse.json({ options: [] });

  const { q, site, limit } = parse.data;

  let query = supabase
    .from("nursery_locations")
    .select("id,name,nursery_site")
    .eq("org_id", profile.active_org_id)
    .order("name", { ascending: true });

  if (site) query = query.eq("nursery_site", site);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[options.locations]", error);
    return NextResponse.json({ options: [] });
  }

  const list = (data ?? []).slice(0, limit);
  return NextResponse.json({
    options: list.map(l => ({
      value: l.id,
      label: l.name,
      meta: { nursery_site: (l as any).nursery_site },
    })),
  });
}